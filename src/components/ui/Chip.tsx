import { cn } from "@/lib/utils";

export function Chip({
  children, active, onClick, small,
}: { children: React.ReactNode; active?: boolean; onClick?: () => void; small?: boolean }) {
  const cls = cn(
    "rounded-full border transition",
    small ? "px-2 py-0.5 text-[11px]" : "px-3.5 py-1.5 text-sm",
    active ? "border-brand/60 bg-brand-soft text-brand" : "border-white/10 bg-ink-700/70 text-muted",
    onClick && "hover:border-brand/40 hover:text-white"
  );
  return onClick ? (
    <button type="button" aria-pressed={!!active} onClick={onClick} className={cls}>{children}</button>
  ) : (
    <span className={cls}>{children}</span>
  );
}
