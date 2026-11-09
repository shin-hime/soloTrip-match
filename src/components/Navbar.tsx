"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { closeSocket } from "@/lib/socket";
import { cn, timeAgo } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { Avatar } from "./ui/Avatar";

const links = [
  { href: "/discover", label: "Discover", icon: "🧭" },
  { href: "/trips/new", label: "New Trip", icon: "✈️" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/groups", label: "Groups", icon: "👥" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const convs = useQuery({ queryKey: ["conversations"], queryFn: api.conversations });
  const notes = useQuery({ queryKey: ["notifications"], queryFn: api.notifications });
  const unread = (convs.data ?? []).reduce((n, c) => n + c.unread_count, 0);
  const hasNewNotes = (notes.data ?? []).some((n) => !n.is_read);

  const readNote = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const signOut = () => {
    closeSocket();
    logout();
    qc.clear();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/discover" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-brand text-sm font-bold">T</span>
          <span className="hidden font-bold sm:inline">TravelMate</span>
        </Link>

        <nav aria-label="Main" className="flex flex-1 gap-1 overflow-x-auto px-1 sm:px-4">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
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
                <span aria-hidden>{l.icon}</span>
                <span className="hidden md:inline">{l.label}</span>
                {l.href === "/messages" && unread > 0 && (
                  <span className="rounded-full bg-violet-brand px-1.5 text-[11px] font-bold text-white">{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="relative">
          <button
            aria-label="Notifications"
            onClick={() => { setBellOpen((o) => !o); setMenuOpen(false); }}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-ink-800"
          >
            🔔
            {hasNewNotes && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />}
          </button>
          {bellOpen && (
            <div className="panel absolute right-0 mt-2 w-72 p-2 shadow-xl">
              {(notes.data ?? []).length === 0 && <p className="p-3 text-sm text-muted">You're all caught up.</p>}
              {(notes.data ?? []).map((n) => (
                <button
                  key={n.notification_id}
                  onClick={() => !n.is_read && readNote.mutate(n.notification_id)}
                  className="block w-full rounded-lg p-3 text-left hover:bg-white/5"
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

        <div className="relative">
          <button aria-label="Account menu" onClick={() => { setMenuOpen((o) => !o); setBellOpen(false); }}>
            <Avatar name={user?.full_name ?? "You"} src={user?.avatar_url} size={36} className="rounded-full ring-2 ring-brand/40" />
          </button>
          {menuOpen && (
            <div className="panel absolute right-0 mt-2 w-44 p-1.5 shadow-xl">
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5">Your profile</Link>
              {user?.role === "admin" && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5">Moderation</Link>
              )}
              <button onClick={signOut} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-white/5 hover:text-white">Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
