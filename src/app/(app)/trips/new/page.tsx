"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

const STYLES = ["Backpacker", "Budget", "Mid-range", "Luxury", "Adventure", "Cultural", "Mindful"];
const INTERESTS = ["Beach", "Food", "Adventure", "Culture", "Shopping", "Hiking", "Diving", "Wellness", "Photography", "Nightlife"];
const MAX_GROUP = 5; // including the creator, per design note

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function NewTripPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [f, setF] = useState({ destination: "", from: "", dep: "", ret: "", budget: "", count: 2 });
  const [styles, setStyles] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      api.createTrip({
        destination: f.destination.trim(),
        traveling_from: f.from.trim(),
        departure_date: f.dep,
        return_date: f.ret,
        budget_usd: f.budget ? Number(f.budget.replace(/[^0-9.]/g, "")) : null,
        looking_for_count: f.count,
        travel_styles: styles,
        interests,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-trip"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      router.push("/discover");
    },
    onError: (e: Error) => setErrors({ form: e.message }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const today = new Date().toISOString().slice(0, 10);
    if (!f.destination.trim()) err.destination = "Enter a destination.";
    if (!f.dep) err.dep = "Choose a departure date.";
    else if (f.dep < today) err.dep = "Departure can't be in the past.";
    if (!f.ret) err.ret = "Choose a return date.";
    else if (f.dep && f.ret < f.dep) err.ret = "Return must be on or after departure.";
    if (f.budget && Number.isNaN(Number(f.budget.replace(/[^0-9.]/g, "")))) err.budget = "Enter a number.";
    setErrors(err);
    if (!Object.keys(err).length) create.mutate();
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: k === "count" ? Number(e.target.value) : e.target.value }));
  const Err = ({ k }: { k: string }) => (errors[k] ? <p role="alert" className="mt-1 text-xs text-red-400">{errors[k]}</p> : null);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 rounded-2xl p-7" style={{ background: "linear-gradient(120deg,#1b2a44,#3b2f4d 60%,#14202c)" }}>
        <h1 className="font-serif text-4xl">Plan your <span className="italic text-brand">trip</span></h1>
        <p className="mt-1 text-sm text-white/70">Tell us about your adventure</p>
      </div>

      <form onSubmit={submit} noValidate className="panel space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="dest">Destination</label><input id="dest" className="field" placeholder="e.g. Phuket, Thailand" value={f.destination} onChange={set("destination")} /><Err k="destination" /></div>
          <div><label className="label" htmlFor="from">Traveling from</label><input id="from" className="field" placeholder="Your city" value={f.from} onChange={set("from")} /></div>
          <div><label className="label" htmlFor="dep">Departure</label><input id="dep" type="date" className="field" value={f.dep} onChange={set("dep")} /><Err k="dep" /></div>
          <div><label className="label" htmlFor="ret">Return</label><input id="ret" type="date" className="field" value={f.ret} min={f.dep || undefined} onChange={set("ret")} /><Err k="ret" /></div>
          <div><label className="label" htmlFor="budget">Budget (USD)</label><input id="budget" inputMode="numeric" className="field" placeholder="e.g. $500" value={f.budget} onChange={set("budget")} /><Err k="budget" /></div>
          <div>
            <label className="label" htmlFor="count">Looking for</label>
            <select id="count" className="field" value={f.count} onChange={set("count")}>
              {Array.from({ length: MAX_GROUP - 1 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} traveler{n > 1 ? "s" : ""}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-muted/70">Max group size is {MAX_GROUP} (including you)</p>
          </div>
        </div>

        <fieldset><legend className="label">Travel style</legend>
          <div className="flex flex-wrap gap-2">{STYLES.map((s) => <Chip key={s} active={styles.includes(s)} onClick={() => setStyles((l) => toggle(l, s))}>{s}</Chip>)}</div>
        </fieldset>
        <fieldset><legend className="label">Interests</legend>
          <div className="flex flex-wrap gap-2">{INTERESTS.map((s) => <Chip key={s} active={interests.includes(s)} onClick={() => setInterests((l) => toggle(l, s))}>{s}</Chip>)}</div>
        </fieldset>

        {errors.form && <p role="alert" className="text-sm text-red-400">{errors.form}</p>}
        <Button type="submit" full disabled={create.isPending} className="py-3">
          {create.isPending ? "Creating…" : "Create trip & find partners"}
        </Button>
      </form>
    </div>
  );
}
