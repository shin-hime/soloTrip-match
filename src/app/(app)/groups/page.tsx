"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtRange, gradientFor } from "@/lib/utils";
import type { NewGroupInput } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

function NewGroupModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<NewGroupInput>({ destination: "", start_date: "", end_date: "", max_members: 5 });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.createGroup(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); onClose(); },
    onError: (e: Error) => setError(e.message),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.destination.trim()) return setError("Enter a destination.");
    if (!f.start_date || !f.end_date || f.end_date < f.start_date) return setError("Choose valid start and end dates.");
    setError(null);
    create.mutate();
  };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="New group">
      <form onSubmit={submit} className="panel w-full max-w-md space-y-4 bg-ink-800 p-6">
        <h2 className="font-serif text-2xl">New group</h2>
        <div><label className="label" htmlFor="gd">Destination</label><input id="gd" className="field" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="gs">Start</label><input id="gs" type="date" className="field" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
          <div><label className="label" htmlFor="ge">End</label><input id="ge" type="date" className="field" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
        </div>
        <div><label className="label" htmlFor="gm">Max members</label>
          <select id="gm" className="field" value={f.max_members} onChange={(e) => setF({ ...f, max_members: Number(e.target.value) })}>
            {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select></div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>Create group</Button>
        </div>
      </form>
    </div>
  );
}

export default function GroupsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const groups = useQuery({ queryKey: ["groups"], queryFn: api.groups });
  const refresh = () => qc.invalidateQueries({ queryKey: ["groups"] });
  const join = useMutation({ mutationFn: api.joinGroup, onSuccess: refresh });
  const leave = useMutation({ mutationFn: api.leaveGroup, onSuccess: refresh });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Trip <span className="italic text-brand">Groups</span></h1>
          <p className="mt-1 text-sm text-muted">Join travelers heading to the same destination</p>
        </div>
        <Button onClick={() => setModal(true)}>+ New group</Button>
      </div>

      {groups.isLoading && <p className="text-sm text-muted">Loading groups…</p>}
      {groups.isError && <p role="alert" className="text-sm text-red-400">Couldn't load groups. Refresh to try again.</p>}
      {groups.isSuccess && groups.data.length === 0 && <p className="text-sm text-muted">No groups yet. Create the first one for your destination.</p>}

      <div className="space-y-4">
        {(groups.data ?? []).map((g) => {
          const full = g.members.length >= g.max_members;
          const pct = (g.members.length / g.max_members) * 100;
          return (
            <article key={g.group_id} className="panel overflow-hidden">
              <div className="relative flex h-32 items-center justify-between p-5" style={{ background: gradientFor(g.destination) }}>
                <div className="rounded-lg bg-black/25 px-3 py-2 backdrop-blur-sm">
                  <h2 className="text-lg font-bold">{g.destination}</h2>
                  <p className="text-xs text-white/80">📅 {fmtRange(g.start_date, g.end_date)} &nbsp; 👥 {g.members.length}/{g.max_members}</p>
                </div>
                {g.is_member ? (
                  <Button variant="outline" disabled={leave.isPending} onClick={() => leave.mutate(g.group_id)}>Leave</Button>
                ) : (
                  <Button disabled={full || join.isPending} onClick={() => join.mutate(g.group_id)}>{full ? "Full" : "Join group"}</Button>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex -space-x-2">
                    {g.members.map((m) => <Avatar key={m.user_id} name={m.full_name} src={m.avatar_url} size={30} className="rounded-full ring-2 ring-ink-800" />)}
                  </span>
                  <span className="text-xs text-muted">{g.members.map((m) => m.full_name.split(" ")[0]).join(" · ")}</span>
                </div>
                <div className="flex items-center gap-3" aria-label={`${g.members.length} of ${g.max_members} spots filled`}>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-brand to-violet-brand" style={{ width: `${pct}%` }} /></span>
                  <span className="text-xs text-muted">{g.members.length}/{g.max_members}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {modal && <NewGroupModal onClose={() => setModal(false)} />}
    </div>
  );
}
