"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Crown, LogOut, MessageCircle, Send, Users } from "lucide-react";
import { api } from "@/lib/api";
import { clockTime, cn, fmtRange, gradientFor } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { GroupMessage } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

export default function GroupHubPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const meId = useAuth((s) => s.user?.user_id);
  const groupId = Number(params.id);
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const group = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api.group(groupId),
    enabled: Number.isInteger(groupId) && groupId > 0,
  });

  const isMember = Boolean(group.data?.is_member);

  const msgs = useQuery({
    queryKey: ["group-messages", groupId],
    queryFn: () => api.groupMessages(groupId),
    enabled: isMember,
    refetchInterval: isMember ? 4000 : false,
  });

  const join = useMutation({
    mutationFn: () => api.joinGroup(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const leave = useMutation({
    mutationFn: () => api.leaveGroup(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      router.push("/groups");
    },
  });

  const send = useMutation({
    mutationFn: (text: string) => api.sendGroupMessage(groupId, text),
    onSuccess: (m) => {
      qc.setQueryData<GroupMessage[]>(["group-messages", groupId], (old) =>
        old ? (old.some((x) => x.message_id === m.message_id) ? old : [...old, m]) : [m]
      );
    },
  });

  const msgList = Array.isArray(msgs.data) ? msgs.data : [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgList.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || send.isPending) return;
    setDraft("");
    send.mutate(text);
  };

  if (group.isLoading) return <p className="text-sm text-muted">Loading group hub…</p>;
  if (group.isError || !group.data) {
    return (
      <div className="panel mx-auto max-w-md p-8 text-center">
        <p role="alert" className="text-sm text-red-400">Couldn't find this trip group.</p>
        <Link href="/groups" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
          <ArrowLeft size={14} aria-hidden /> Back to groups
        </Link>
      </div>
    );
  }

  const g = group.data;
  const members = Array.isArray(g.members) ? g.members : [];
  const full = members.length >= g.max_members;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/groups" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-white">
          <ArrowLeft size={16} aria-hidden /> Back to groups
        </Link>
        {isMember && (
          <Button
            variant="outline"
            disabled={leave.isPending}
            onClick={() => leave.mutate()}
            className="inline-flex items-center gap-1.5"
          >
            <LogOut size={14} aria-hidden /> Leave group
          </Button>
        )}
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6" style={{ background: gradientFor(g.destination) }}>
          <div className="rounded-lg bg-black/25 px-4 py-2.5 backdrop-blur-sm">
            <h1 className="font-serif text-3xl">{g.destination}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-4 text-xs text-white/85">
              <span className="inline-flex items-center gap-1.5"><Calendar size={14} aria-hidden /> {fmtRange(g.start_date, g.end_date)}</span>
              <span className="inline-flex items-center gap-1.5"><Users size={14} aria-hidden /> {members.length}/{g.max_members} travelers</span>
            </p>
          </div>
          {!isMember && (
            <Button disabled={full || join.isPending} onClick={() => join.mutate()}>
              {full ? "Group full" : join.isPending ? "Joining…" : "Join group"}
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="panel p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users size={15} className="text-brand" aria-hidden /> Members ({members.length}/{g.max_members})
          </h2>
          {members.length === 0 ? (
            <p className="text-xs text-muted">No members yet.</p>
          ) : (
            <ul className="space-y-3">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar name={m.full_name} src={m.avatar_url} size={34} className="rounded-full ring-1 ring-white/10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.full_name}</p>
                    <p className="flex items-center gap-1 text-[11px] capitalize text-muted">
                      {m.role === "host" && <Crown size={11} className="text-amber-300" aria-hidden />}
                      {m.role}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="panel flex h-[calc(100vh-20rem)] min-h-[420px] flex-col">
          <header className="flex items-center gap-2 border-b border-white/5 px-5 py-3.5">
            <MessageCircle size={16} className="text-brand" aria-hidden />
            <h2 className="text-sm font-semibold">Group Chat</h2>
          </header>

          {!isMember ? (
            <div className="m-auto p-6 text-center text-sm text-muted">
              <p>Join this group to view and send messages with fellow travelers.</p>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5" aria-live="polite">
                {msgs.isLoading && <p className="text-sm text-muted">Loading messages…</p>}
                {msgs.isSuccess && msgList.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello to the group!</p>
                )}
                {msgList.map((m) => {
                  const mine = m.sender_id === meId;
                  return (
                    <div key={m.message_id} className={cn("flex flex-col pb-2", mine ? "items-end" : "items-start")}>
                      {!mine && <span className="mb-1 text-[11px] font-medium text-muted">{m.sender_name}</span>}
                      <p className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                        mine ? "bg-brand/90 font-medium text-ink-950" : "border border-white/10 bg-ink-700"
                      )}>
                        {m.content}
                      </p>
                      <span className="mt-1 text-[11px] text-muted/70">{clockTime(m.sent_at)}</span>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>

              <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/5 p-4">
                <input
                  className="field rounded-full px-5"
                  placeholder={`Message ${g.destination} group…`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Type a group message"
                />
                <button
                  type="submit"
                  aria-label="Send group message"
                  disabled={!draft.trim() || send.isPending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-600 transition hover:bg-brand hover:text-ink-950 disabled:opacity-40"
                >
                  <Send size={16} aria-hidden />
                </button>
              </form>
              {send.isError && <p role="alert" className="px-5 pb-3 text-xs text-red-400">Message not sent. Try again.</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
