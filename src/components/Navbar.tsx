"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Compass, MessageCircle, Plane, Shield, User, Users } from "lucide-react";
import { api } from "@/lib/api";
import { closeSocket } from "@/lib/socket";
import { cn, timeAgo } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { AppNotification } from "@/types";
import { Avatar } from "./ui/Avatar";

const travelerLinks = [
  { href: "/discover", label: "Discover", Icon: Compass },
  { href: "/trips/new", label: "New Trip", Icon: Plane },
  { href: "/messages", label: "Messages", Icon: MessageCircle },
  { href: "/groups", label: "Groups", Icon: Users },
  { href: "/profile", label: "Profile", Icon: User },
];

const adminLinks = [
  { href: "/moderation", label: "Moderation", Icon: Shield },
];

function notificationHref(n: AppNotification & { group_id?: number | null }): string {
  const type = (n.type ?? "").toLowerCase();
  const title = (n.title ?? "").toLowerCase();
  if (
    type === "match" ||
    type === "message" ||
    type === "chat_request" ||
    type === "request_accepted" ||
    title.includes("match") ||
    title.includes("chat") ||
    title.includes("message")
  ) {
    return "/messages";
  }
  if (type === "group" || title.includes("group")) {
    return n.group_id ? `/groups/${n.group_id}` : "/groups";
  }
  if (type === "like" || title.includes("like")) {
    return "/discover";
  }
  return "/discover";
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role?.toLowerCase() === "admin";

  useEffect(() => {
    setBellOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!bellOpen && !menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (bellOpen && bellRef.current && !bellRef.current.contains(t)) setBellOpen(false);
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBellOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [bellOpen, menuOpen]);

  const convs = useQuery({ queryKey: ["conversations"], queryFn: api.conversations, enabled: !isAdmin });
  const notes = useQuery({ queryKey: ["notifications"], queryFn: api.notifications });
  const navLinks = isAdmin ? adminLinks : travelerLinks;
  const convList = Array.isArray(convs.data) ? convs.data : [];
  const noteList = Array.isArray(notes.data) ? notes.data : [];
  const unread = convList.reduce((n, c) => n + Number(c.unread_count ?? 0), 0);
  const hasNewNotes = noteList.some((n) => !n.is_read);

  const readNote = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.is_read) readNote.mutate(n.notification_id);
    setBellOpen(false);
    router.push(notificationHref(n));
  };

  const signOut = () => {
    closeSocket();
    logout();
    qc.clear();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href={isAdmin ? "/moderation" : "/discover"} className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200 bg-gradient-to-br from-sky-300 via-blue-500 to-cyan-700 font-serif text-xl italic text-white shadow-[0_0_10px_#38bdf8,0_0_22px_#0ea5e9]">
  𝑺

  <span className="absolute -inset-1 top-[9px] rotate-[-25deg] rounded-[50%] border border-cyan-200 shadow-[0_0_5px_#38bdf8]" />

  <span className="absolute -right-2 -top-1 text-[10px] text-cyan-200">
    ✈
  </span>
</span>
          <span className="hidden font-bold sm:inline">SoloTrip Match</span>
        </Link>

        <nav aria-label="Main" className="flex flex-1 gap-1 overflow-x-auto px-1 sm:px-4">
          {navLinks.map((l) => {
            const active =
              pathname === l.href ||
              pathname.startsWith(l.href + "/") ||
              (l.href === "/moderation" && pathname === "/admin");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                  active ? "border-brand/50 bg-brand-soft text-brand" : "border-transparent text-muted hover:text-white"
                )}
              >
                <l.Icon size={16} aria-hidden />
                <span className="hidden md:inline">{l.label}</span>
                {l.href === "/messages" && unread > 0 && (
                  <span className="rounded-full bg-violet-brand px-1.5 text-[11px] font-bold text-white">{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="relative" ref={bellRef}>
          <button
            aria-label="Notifications"
            onClick={() => { setBellOpen((o) => !o); setMenuOpen(false); }}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-ink-800"
          >
            <Bell size={16} aria-hidden />
            {hasNewNotes && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />}
          </button>
          {bellOpen && (
            <div className="absolute right-0 z-50 mt-2 max-h-96 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-ink-800 p-2 shadow-xl">
              {noteList.length === 0 && <p className="p-3 text-sm text-muted">You're all caught up.</p>}
              {noteList.map((n) => (
                <button
                  key={n.notification_id}
                  onClick={() => handleNotificationClick(n)}
                  className="block w-full rounded-lg p-3 text-left transition hover:bg-white/5"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                    {n.title}
                  </p>
                  <p className="text-xs text-muted">{n.message}</p>
                  <p className="mt-1 text-[11px] text-muted/70">{timeAgo(n.created_at)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button aria-label="Account menu" onClick={() => { setMenuOpen((o) => !o); setBellOpen(false); }}>
            <Avatar name={user?.full_name ?? "You"} src={user?.avatar_url} size={36} className="rounded-full ring-2 ring-brand/40" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-white/10 bg-ink-800 p-1.5 shadow-xl">
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5">Your profile</Link>
              {isAdmin && (
                <Link href="/moderation" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5">Moderation</Link>
              )}
              <button onClick={signOut} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-white/5 hover:text-white">Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
