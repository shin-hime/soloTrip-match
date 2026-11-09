"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { clockTime, cn, timeAgo } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { DirectMessage } from "@/types";
import { Avatar } from "@/components/ui/Avatar";

export default function MessagesPage() {
  const qc = useQueryClient();
  const meId = useAuth((s) => s.user?.user_id);
  const [active, setActive] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const convs = useQuery({ queryKey: ["conversations"], queryFn: api.conversations });
  const msgs = useQuery({ queryKey: ["messages", active], queryFn: () => api.messages(active!), enabled: active !== null });
  const current = convs.data?.find((c) => c.conversation_id === active);

  const filtered = useMemo(
    () => (convs.data ?? []).filter((c) => c.other_user.full_name.toLowerCase().includes(search.toLowerCase())),
    [convs.data, search]
  );

  const append = (m: DirectMessage) =>
    qc.setQueryData<DirectMessage[]>(["messages", m.conversation_id], (old) =>
      old && !old.some((x) => x.message_id === m.message_id) ? [...old, m] : old
    );

  // Real-time: server pushes `message:new` for any conversation the user is in.
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onNew = (m: DirectMessage) => {
      append(m);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    };
    s.on("message:new", onNew);
    return () => { s.off("message:new", onNew); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  const open = (id: number) => {
    setActive(id);
    api.markRead(id).then(() => qc.invalidateQueries({ queryKey: ["conversations"] }));
  };

  const send = useMutation({
    mutationFn: (text: string) => api.sendMessage(active!, text),
    onSuccess: (m) => {
      append(m);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.data?.length, active]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || active === null) return;
    setDraft("");
    send.mutate(text);
  };

  return (
    <div className="grid h-[calc(100vh-9rem)] min-h-[480px] gap-5 md:grid-cols-[320px_1fr]">
      <aside className={cn("panel flex min-h-0 flex-col", active !== null && "hidden md:flex")}>
        <div className="p-5 pb-4">
          <h1 className="font-serif text-2xl">Messages</h1>
          <input className="field mt-4" placeholder="Search conversations…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search conversations" />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-white/5">
          {convs.isLoading && <li className="p-5 text-sm text-muted">Loading…</li>}
          {convs.isSuccess && filtered.length === 0 && (
            <li className="p-5 text-sm text-muted">{search ? "No conversations match." : "No conversations yet. Send a chat request from Discover."}</li>
          )}
          {filtered.map((c) => (
            <li key={c.conversation_id}>
              <button onClick={() => open(c.conversation_id)}
                className={cn("flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-white/5", c.conversation_id === active && "bg-white/[0.06]")}>
                <Avatar name={c.other_user.full_name} src={c.other_user.avatar_url} online={c.other_user.is_online} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2">
                    <span className="truncate font-semibold">{c.other_user.full_name}</span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(c.last_message_at)}</span>
                  </span>
                  <span className="block truncate text-sm text-muted">{c.last_message_text}</span>
                </span>
                {c.unread_count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-brand px-1.5 text-[11px] font-bold">{c.unread_count}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className={cn("panel flex min-h-0 flex-col", active === null && "hidden md:flex")}>
        {current ? (
          <>
            <header className="flex items-center gap-3 border-b border-white/5 p-4">
              <button className="mr-1 text-muted md:hidden" aria-label="Back to conversations" onClick={() => setActive(null)}>←</button>
              <Avatar name={current.other_user.full_name} src={current.other_user.avatar_url} online={current.other_user.is_online} size={44} />
              <div>
                <p className="font-semibold">{current.other_user.full_name}</p>
                <p className="text-sm text-brand">
                  {current.other_user.is_online ? "Online" : "Offline"}
                  {current.other_user.destination ? ` · ${current.other_user.destination}` : ""}
                </p>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-5" aria-live="polite">
              {msgs.isLoading && <p className="text-sm text-muted">Loading messages…</p>}
              {(msgs.data ?? []).map((m) => {
                const mine = m.sender_id === meId;
                return (
                  <div key={m.message_id} className={cn("flex flex-col pb-3", mine ? "items-end" : "items-start")}>
                    <p className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", mine ? "bg-brand/90 font-medium text-ink-950" : "border border-white/10 bg-ink-700")}>
                      {m.content}
                    </p>
                    <span className="mt-1 text-[11px] text-muted/70">{clockTime(m.sent_at)}</span>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>

            <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/5 p-4">
              <input className="field rounded-full px-5" placeholder="Type a message…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Type a message" />
              <button type="submit" aria-label="Send message" disabled={!draft.trim() || send.isPending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-600 transition hover:bg-brand hover:text-ink-950 disabled:opacity-40">➤</button>
            </form>
            {send.isError && <p role="alert" className="px-5 pb-3 text-xs text-red-400">Message not sent. Try again.</p>}
          </>
        ) : (
          <div className="m-auto text-center text-muted"><p className="text-4xl">💬</p><p className="mt-2 text-sm">Select a conversation to start chatting</p></div>
        )}
      </section>
    </div>
  );
}
