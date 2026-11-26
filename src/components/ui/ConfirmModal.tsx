"use client";
import { useEffect } from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  loadingLabel,
  cancelLabel = "Cancel",
  variant = "primary",
  isLoading = false,
  error = null,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, isLoading, onClose]);

  if (!open) return null;

  const isDanger = variant === "danger";
  const Icon = isDanger ? AlertTriangle : ShieldCheck;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="panel w-full max-w-md rounded-2xl border border-white/10 bg-ink-800 p-6 shadow-2xl">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              isDanger
                ? "border-rose-400/25 bg-rose-500/15 text-rose-300"
                : "border-emerald-400/25 bg-emerald-500/15 text-emerald-300"
            )}
          >
            <Icon size={20} aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-serif text-2xl leading-tight text-white">{title}</h2>
              <button
                type="button"
                aria-label="Close"
                disabled={isLoading}
                onClick={onClose}
                className="rounded-lg p-1 text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={onClose}
            className="border border-white/10 bg-white/5 text-muted hover:bg-white/10 hover:text-white"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDanger ? "outline" : "primary"}
            disabled={isLoading}
            onClick={onConfirm}
            className={
              isDanger
                ? "border-rose-400/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                : undefined
            }
          >
            {isLoading ? (loadingLabel ?? "Working...") : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
