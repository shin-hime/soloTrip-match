import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  full?: boolean;
};

export function Button({ variant = "primary", full, className, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-gradient-to-r from-brand to-brand-dark text-ink-950 hover:shadow-glow",
        variant === "outline" && "border border-white/10 bg-ink-700/70 text-white hover:border-brand/50",
        variant === "ghost" && "text-muted hover:text-white",
        full && "w-full",
        className
      )}
    />
  );
}
