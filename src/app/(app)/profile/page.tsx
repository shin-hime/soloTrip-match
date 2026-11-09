"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtRange, gradientFor } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";

export default function ProfilePage() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const trip = useQuery({ queryKey: ["active-trip"], queryFn: api.myActiveTrip });

  const update = useMutation({
    mutationFn: api.updateMe,
    onSuccess: (u) => { setUser(u); qc.setQueryData(["me"], u); },
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
              {[["Trips", u.trips_count], ["Matches", u.matches_count], ["Rating", u.rating.toFixed(1)]].map(([label, val]) => (
                <div key={label as string}><dd>{val}</dd><dt className="font-sans text-[11px] text-muted">{label}</dt></div>
              ))}
            </dl>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="mb-2 text-sm font-semibold">Safety & privacy</h2>
          <label className="flex cursor-pointer items-center justify-between py-2 text-sm">
            <span>🔒 Hide contact info</span>
            <input type="checkbox" className="h-4 w-4 accent-[#00e0c6]" checked={u.hide_contact_info}
              disabled={update.isPending} onChange={(e) => update.mutate({ hide_contact_info: e.target.checked })} />
          </label>
          <p className="border-t border-white/5 pt-2 text-xs text-muted">
            To block or report someone, use the options on their profile or in a conversation.
          </p>
        </section>
      </div>

      <div className="space-y-5">
        <section className="panel p-5"><h2 className="mb-2 text-sm font-semibold">About me</h2><p className="text-sm text-muted">{u.bio ?? "Add a short bio so travelers know what you're like."}</p></section>
        <section className="panel p-5">
          <h2 className="mb-2 text-sm font-semibold">Travel style</h2>
          <Row k="Style" v={u.travel_styles.join(" · ") || null} />
          <Row k="Budget" v={u.budget_range} />
        </section>
        <section className="panel p-5">
          <h2 className="mb-3 text-sm font-semibold">Interests</h2>
          <div className="flex flex-wrap gap-2">{u.interests.map((i) => <Chip key={i} active>{i}</Chip>)}</div>
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
    </div>
  );
}
