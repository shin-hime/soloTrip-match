export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const month = (d: Date) => d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });

/** "2026-12-10","2026-12-22" -> "Dec 10 – 22" */
export function fmtRange(a: string, b: string) {
  const s = new Date(a);
  const e = new Date(b);
  return month(s) === month(e)
    ? `${month(s)} ${s.getUTCDate()} – ${e.getUTCDate()}`
    : `${month(s)} ${s.getUTCDate()} – ${month(e)} ${e.getUTCDate()}`;
}

export function timeAgo(iso: string | null) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/** Stable gradient per string, used where photos are not available yet. */
export function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 55% 32%), hsl(${(h + 50) % 360} 60% 18%))`;
}
