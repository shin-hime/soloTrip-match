"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtRange, gradientFor } from "@/lib/utils";
import type { MatchedTraveler } from "@/types";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { UserSafetyMenu } from "@/components/UserSafetyMenu";

function Photo({ name, className }: { name: string; className?: string }) {
  return <div className={className} style={{ background: gradientFor(name) }} />;
}

export default function DiscoverPage() {
    const qc = useQueryClient();

  const trips = useQuery({ queryKey: ["my-trips"], queryFn: api.myTrips });
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectionLoaded, setSelectionLoaded] = useState(false);

  useEffect(() => {
    if (!trips.isSuccess || !trips.data) return;

    const savedId = Number(localStorage.getItem("solotrip-selected-trip"));
    const exists = trips.data.some((t) => t.trip_id === savedId);

    setSelectedTripId(
      exists ? savedId : trips.data[0]?.trip_id ?? null
    );

    setSelectionLoaded(true);
  }, [trips.isSuccess, trips.data]);

  const trip =
    trips.data?.find((t) => t.trip_id === selectedTripId) ??
    trips.data?.[0] ??
    null;

  useEffect(() => {
    setActive({});
    setQueue([]);
  }, [trip?.trip_id]);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [queue, setQueue] = useState<MatchedTraveler[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Filter chips are derived from the user's active trip; all on by default.
  const chips = useMemo(() => {
    const t = trip;
    if (!t) return [];
    return [
      { key: "destination", label: t.destination },
      { key: "dates", label: fmtRange(t.departure_date, t.return_date) },
      ...(t.budget_usd ? [{ key: "budget", label: `$${Math.round(t.budget_usd * 0.6)}–${Math.round(t.budget_usd * 1.3)}` }] : []),
    ];
  }, [trip]);

  useEffect(() => {
    if (chips.length && Object.keys(active).length === 0) setActive(Object.fromEntries(chips.map((c) => [c.key, true])));
  }, [chips, active]);

  const filters = useMemo(() => {
    const t = trip;
    if (!t) return {};
    return {
      destination: active.destination ? t.destination : undefined,
      from: active.dates ? t.departure_date : undefined,
      to: active.dates ? t.return_date : undefined,
      budget_min: active.budget && t.budget_usd ? Math.round(t.budget_usd * 0.6) : undefined,
      budget_max: active.budget && t.budget_usd ? Math.round(t.budget_usd * 1.3) : undefined,
    };
  }, [trip, active]);

  const matches = useQuery({
  queryKey: ["matches", filters, trip?.trip_id],
  queryFn: () => api.matches(filters, trip!.trip_id),
  enabled: trips.isSuccess && selectionLoaded && !!trip,
});

  useEffect(() => { if (matches.data) setQueue(matches.data); }, [matches.data]);

  const like = useMutation({
    mutationFn: (id: number) => api.sendChatRequest(id),
    onSuccess: () => setToast("Chat request sent."),
    onError: (e: Error) => setToast(e.message),
  });

  const current = queue[0];
  console.log("DISCOVER FRONTEND:", {
  loading: matches.isLoading,
  error: matches.error,
  matches: matches.data,
  count: matches.data?.length,
});
  const next = () => setQueue((q) => q.slice(1));
  const choose = (u: MatchedTraveler) => setQueue((q) => [u, ...q.filter((x) => x.user_id !== u.user_id)]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (trips.isSuccess && (!trips.data || trips.data.length === 0)) {
    return (
      <div className="panel mx-auto max-w-md p-8 text-center">
        <h1 className="font-serif text-3xl">Plan a trip to see matches</h1>
        <p className="mt-2 text-sm text-muted">We match you with travelers whose destination and dates overlap yours.</p>
        <Button className="mt-5" onClick={() => (window.location.href = "/trips/new")}>Create a trip</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section>
        <h1 className="font-serif text-5xl leading-tight">
          Discover <span className="italic text-brand">Travel Partners</span>
        </h1>
        <p className="mt-3 text-sm text-muted">
          {matches.isLoading ? "Finding matches…" : `${matches.data?.length ?? 0} travelers match this trip`}
        </p>
      {(trips.data?.length ?? 0) > 1 && (
  <div className="mt-5">
    <label htmlFor="discover-trip" className="mb-2 block text-sm text-muted">
      Choose a trip to find matches
    </label>
    <select
      id="discover-trip"
      className="field w-full sm:max-w-sm"
      value={trip?.trip_id ?? ""}
      onChange={(e) => {
  const id = Number(e.target.value);
  setSelectedTripId(id);
  localStorage.setItem("solotrip-selected-trip", String(id));
  setActive({});
  setQueue([]);
}}
    >
      {trips.data?.map((t) => (
        <option key={t.trip_id} value={t.trip_id}>
          {t.destination} · {fmtRange(t.departure_date, t.return_date)}
        </option>
      ))}
    </select>
  </div>
)}
        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((c) => (
            <Chip key={c.key} active={active[c.key]} onClick={() => setActive((a) => ({ ...a, [c.key]: !a[c.key] }))}>
              {c.label}
            </Chip>
          ))}
        </div>

        {matches.isError && <p role="alert" className="mt-6 text-sm text-red-400">Couldn't load matches. Check your connection and refresh.</p>}
        {matches.isSuccess && matches.data.length === 0 && (
          <p className="mt-8 text-sm text-muted">No travelers overlap these filters yet. Turn off a filter or widen your dates.</p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(matches.data ?? []).map((u) => (
            <div
              key={u.user_id}
              role="button"
              tabIndex={0}
              onClick={() => choose(u)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  choose(u);
                }
              }}
              className="panel cursor-pointer overflow-hidden text-left transition hover:border-brand/40"
            >
              <div className="relative h-28">
                <Photo name={u.destination} className="absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <Link
                    href={`/users/${u.user_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block font-semibold hover:text-brand hover:underline"
                  >
                    {u.full_name}
                  </Link>
                  <p className="text-xs text-brand">📍 {u.destination}</p>
                </div>
              </div>
              <div className="p-3">
                <div className="flex justify-between text-xs text-muted">
                  <span>{fmtRange(u.departure_date, u.return_date)}</span>
                  <span>★ {Number(u.rating ?? 0).toFixed(1)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(u.interests ?? []).slice(0, 2).map((i) => <Chip key={i} small active>{i}</Chip>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside aria-label="Up next">
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span>Up next</span>
          <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => matches.refetch()}>↺ Refresh</Button>
        </div>

        {current ? (
          <div className="panel overflow-hidden">
            <div className="relative h-52">
              <Photo name={current.destination} className="absolute inset-0" />
              <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2">
                {(current.travel_styles ?? [])[0] ? (
                  <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-brand">{current.travel_styles[0]}</span>
                ) : (
                  <span />
                )}
                <UserSafetyMenu
                  userId={current.user_id}
                  userName={current.full_name}
                  buttonClassName="h-8 w-8 rounded-full border-white/15 bg-black/45 text-white hover:bg-black/65"
                  onReported={() => setToast(`Report submitted for ${current.full_name}.`)}
                  onBlocked={() => {
                    const blockedId = current.user_id;
                    const blockedName = current.full_name;
                    setQueue((q) => q.filter((x) => x.user_id !== blockedId));
                    qc.invalidateQueries({ queryKey: ["matches"] });
                    qc.invalidateQueries({ queryKey: ["conversations"] });
                    setToast(`${blockedName} has been blocked.`);
                  }}
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 to-transparent p-4">
                <div>
                  <Link href={`/users/${current.user_id}`} className="font-serif text-2xl hover:text-brand hover:underline">
                    {current.full_name}{current.age ? `, ${current.age}` : ""}
                  </Link>
                  <p className="text-xs text-brand">📍 {current.destination}</p>
                </div>
                <span className="rounded-full bg-black/40 px-2 py-1 text-xs">★ {Number(current.rating ?? 0).toFixed(1)}</span>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border border-brand/20 bg-brand-soft p-2"><p className="text-muted">Dates</p><p className="font-semibold text-brand">{fmtRange(current.departure_date, current.return_date)}</p></div>
                <div className="rounded-lg border border-violet-brand/30 bg-violet-soft p-2"><p className="text-muted">Budget</p><p className="font-semibold">{current.budget_usd ? `$${current.budget_usd}` : "—"}</p></div>
                <div className="rounded-lg border border-white/10 p-2"><p className="text-muted">Trips</p><p className="font-semibold">{current.trips_count ?? 0}</p></div>
              </div>
              {current.bio && <p className="text-sm text-muted">{current.bio}</p>}
              <div className="flex flex-wrap gap-1.5">{(current.interests ?? []).map((i) => <Chip key={i} small active>{i}</Chip>)}</div>
            </div>
          </div>
        ) : (
          <div className="panel p-8 text-center text-sm text-muted">You've seen everyone for now. Refresh to check for new matches.</div>
        )}
        
        {current && (
          <div className="mt-5 flex items-center justify-center gap-4">
            <button aria-label="Skip" onClick={next} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-ink-700 text-muted hover:text-white">✕</button>
            <button aria-label="Send chat request" disabled={like.isPending}
              onClick={() => { like.mutate(current.user_id); next(); }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-xl text-ink-950 shadow-glow">♥</button>
            <button aria-label={saved.includes(current.user_id) ? "Saved" : "Save for later"}
              onClick={() => { setSaved((s) => [...s, current.user_id]); setToast("Saved for this session."); next(); }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-ink-700">⭐</button>
          </div>
        )}
      </aside>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-brand/40 bg-ink-800 px-4 py-2 text-sm shadow-xl">{toast}</div>
      )}
    </div>
  );
}
