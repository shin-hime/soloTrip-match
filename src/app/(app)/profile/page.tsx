"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtRange, gradientFor } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { User } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

const STYLES = ["Backpacker", "Budget", "Mid-range", "Luxury", "Adventure", "Cultural", "Mindful"];
const INTERESTS = ["Beach", "Food", "Adventure", "Culture", "Shopping", "Hiking", "Diving", "Wellness", "Photography", "Nightlife"];

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function EditProfileModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: (u: User) => void }) {
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [age, setAge] = useState(user.age != null ? String(user.age) : "");
  const [origin, setOrigin] = useState(user.origin_location ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [budgetRange, setBudgetRange] = useState(user.budget_range ?? "");
  const [styles, setStyles] = useState<string[]>(user.travel_styles ?? []);
  const [interests, setInterests] = useState<string[]>(user.interests ?? []);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api.updateMe({
        full_name: fullName.trim(),
        age: age.trim() ? Number(age) : null,
        origin_location: origin.trim() || null,
        bio: bio.trim() || null,
        budget_range: budgetRange.trim() || null,
        travel_styles: styles,
        interests,
      }),
    onSuccess: (updated) => {
      onSaved(updated);
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    if (!fullName.trim()) return setError("Full name is required.");
    if (age.trim()) {
      const n = Number(age);
      if (!Number.isInteger(n) || n < 16 || n > 100) return setError("Enter a valid age (16–100).");
    }
    setError(null);
    save.mutate();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Edit profile">
      <form onSubmit={submit} className="panel max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto bg-ink-800 p-6">
        <h2 className="font-serif text-2xl">Edit profile</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pf-name">Full name</label>
            <input id="pf-name" className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pf-age">Age</label>
            <input id="pf-age" type="number" min={16} max={100} className="field" placeholder="e.g. 25" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pf-origin">Origin location</label>
            <input id="pf-origin" className="field" placeholder="e.g. Bangkok, Thailand" value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pf-budget">Budget range</label>
            <input id="pf-budget" className="field" placeholder="e.g. $500–$1,000" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="pf-bio">About me</label>
          <textarea id="pf-bio" rows={3} className="field" placeholder="Tell travelers a bit about yourself…" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        <fieldset>
          <legend className="label">Travel style</legend>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <Chip key={s} active={styles.includes(s)} onClick={() => setStyles((l) => toggle(l, s))}>{s}</Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Interests</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <Chip key={i} active={interests.includes(i)} onClick={() => setInterests((l) => toggle(l, i))}>{i}</Chip>
            ))}
          </div>
        </fieldset>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" disabled={save.isPending} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  const [editing, setEditing] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const trip = useQuery({ queryKey: ["active-trip"], queryFn: api.myActiveTrip });

  const syncUser = (u: User) => {
    setUser(u);
    qc.setQueryData(["me"], u);
  };

  const update = useMutation({
    mutationFn: api.updateMe,
    onSuccess: syncUser,
  });

  const u = me.data;
  if (me.isLoading) return <p className="text-sm text-muted">Loading profile…</p>;
  if (!u) return <p role="alert" className="text-sm text-red-400">Couldn't load your profile. Refresh to try again.</p>;

  const Row = ({ k, v }: { k: string; v: string | null }) => (
    <div className="flex justify-between py-1.5 text-sm"><span className="text-muted">{k}</span><span>{v ?? "—"}</span></div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="space-y-5">
        <section className="panel overflow-hidden">
          <div className="h-24" style={{ background: u.cover_photo_url ? `url(${u.cover_photo_url}) center/cover` : gradientFor(u.origin_location ?? u.full_name) }} />
          <div className="px-5 pb-5">
            <Avatar name={u.full_name} src={u.avatar_url} size={64} className="-mt-8 rounded-2xl ring-2 ring-brand/60 [&>*]:rounded-2xl" />
            <h1 className="mt-3 text-lg font-bold">{u.full_name}{u.age ? `, ${u.age}` : ""}</h1>
            <p className="text-xs text-muted">{u.origin_location}{u.is_verified ? " · Verified ✓" : ""}</p>
            <dl className="mt-4 flex gap-6 font-serif text-xl">
              {[["Trips", u.trips_count ?? 0], ["Matches", u.matches_count ?? 0], ["Rating", Number(u.rating ?? 0).toFixed(1)]].map(([label, val]) => (
                <div key={label as string}><dd>{val}</dd><dt className="font-sans text-[11px] text-muted">{label}</dt></div>
              ))}
            </dl>
            <Button variant="outline" full className="mt-4" onClick={() => setEditing(true)}>Edit profile</Button>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="mb-2 text-sm font-semibold">Safety & privacy</h2>
          <label className="flex cursor-pointer items-center justify-between py-2 text-sm">
            <span>🔒 Hide contact info</span>
            <input type="checkbox" className="h-4 w-4 accent-[#00e0c6]" checked={u.hide_contact_info}
              disabled={update.isPending} onChange={(e) => update.mutate({ hide_contact_info: e.target.checked })} />
          </label>
          {update.isError && <p role="alert" className="pb-2 text-xs text-red-400">Couldn't save setting. Try again.</p>}
          <p className="border-t border-white/5 pt-2 text-xs text-muted">
            To block or report someone, use the options on their profile or in a conversation.
          </p>
        </section>
      </div>

      <div className="space-y-5">
        <section className="panel p-5"><h2 className="mb-2 text-sm font-semibold">About me</h2><p className="text-sm text-muted">{u.bio ?? "Add a short bio so travelers know what you're like."}</p></section>
        <section className="panel p-5">
          <h2 className="mb-2 text-sm font-semibold">Travel style</h2>
          <Row k="Style" v={(u.travel_styles ?? []).join(" · ") || null} />
          <Row k="Budget" v={u.budget_range} />
        </section>
        <section className="panel p-5">
          <h2 className="mb-3 text-sm font-semibold">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {(u.interests ?? []).length > 0
              ? (u.interests ?? []).map((i) => <Chip key={i} active>{i}</Chip>)
              : <p className="text-sm text-muted">No interests added yet.</p>}
          </div>
        </section>
        {trip.data && (
          <section className="panel flex items-center justify-between border-brand/30 p-5">
            <div>
              <h2 className="text-sm font-semibold text-brand">Active trip</h2>
              <p className="mt-1 font-semibold">{trip.data.destination} · {fmtRange(trip.data.departure_date, trip.data.return_date)}</p>
              <p className="text-xs text-muted">Looking for {trip.data.looking_for_count} travel companion{trip.data.looking_for_count > 1 ? "s" : ""}</p>
            </div>
            <span className="text-3xl" aria-hidden>🏖️</span>
          </section>
        )}
      </div>

      {editing && <EditProfileModal user={u} onClose={() => setEditing(false)} onSaved={syncUser} />}
    </div>
  );
}
