import { cn, gradientFor, initials } from "@/lib/utils";

export function Avatar({
  name, src, size = 40, online, className,
}: { name: string; src?: string | null; size?: number; online?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span
          aria-label={name}
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white/90"
          style={{ background: gradientFor(name), fontSize: size * 0.36 }}
        >
          {initials(name)}
        </span>
      )}
      {online !== undefined && online && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-ink-800 bg-brand" />
      )}
    </span>
  );
}
