"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Ban, Flag, MoreVertical, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

const REPORT_REASONS = [
  "Harassment",
  "Spam",
  "Fake profile",
  "Inappropriate behavior",
  "Other",
] as const;

type ReportReason = (typeof REPORT_REASONS)[number];

interface UserSafetyMenuProps {
  userId: number;
  userName: string;
  onReported?: () => void;
  onBlocked?: () => void;
  buttonClassName?: string;
}

export function UserSafetyMenu({
  userId,
  userName,
  onReported,
  onBlocked,
  buttonClassName,
}: UserSafetyMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"report" | "block" | null>(null);
  const [reason, setReason] = useState<ReportReason>("Harassment");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setModal(null);
    setError(null);
  }, [userId]);

  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setError(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modal]);

  const closeModal = () => {
    setModal(null);
    setError(null);
    setReason("Harassment");
    setDetails("");
  };

  const reportMutation = useMutation({
    mutationFn: (fullReason: string) => api.reportUser(userId, fullReason),
    onSuccess: () => {
      closeModal();
      onReported?.();
    },
    onError: (e: Error) => setError(e.message || "Couldn't submit report. Try again."),
  });

  const blockMutation = useMutation({
    mutationFn: () => api.blockUser(userId),
    onSuccess: () => {
      closeModal();
      onBlocked?.();
    },
    onError: (e: Error) => setError(e.message || "Couldn't block user. Try again."),
  });

  const submitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (reportMutation.isPending) return;
    const trimmed = details.trim();
    if (reason === "Other" && trimmed.length < 3) {
      setError("Please provide at least 3 characters describing the issue.");
      return;
    }
    const fullReason = trimmed ? `${reason}: ${trimmed}` : reason;
    if (fullReason.length > 1000) {
      setError("Details must be under 1000 characters.");
      return;
    }
    setError(null);
    reportMutation.mutate(fullReason);
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label={`More options for ${userName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-ink-800/80 text-muted transition hover:border-white/20 hover:text-white",
            buttonClassName
          )}
        >
          <MoreVertical size={16} aria-hidden />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-white/10 bg-ink-800 p-1.5 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setError(null);
                setModal("report");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-white transition hover:bg-white/5"
            >
              <Flag size={15} className="text-amber-300" aria-hidden />
              <span>Report user</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setError(null);
                setModal("block");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition hover:bg-white/5 hover:text-red-300"
            >
              <Ban size={15} aria-hidden />
              <span>Block user</span>
            </button>
          </div>
        )}
      </div>

      {modal === "report" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Report ${userName}`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !reportMutation.isPending) closeModal();
          }}
        >
          <form onSubmit={submitReport} className="panel w-full max-w-md space-y-4 bg-ink-800 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">Report {userName}</h2>
                <p className="mt-1 text-xs text-muted">
                  Reports are reviewed by our moderation team.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeModal}
                className="rounded-lg p-1 text-muted transition hover:bg-white/5 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <fieldset>
              <legend className="label">Reason</legend>
              <div className="space-y-2">
                {REPORT_REASONS.map((opt) => (
                  <label
                    key={opt}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition",
                      reason === opt
                        ? "border-brand/50 bg-brand-soft text-white"
                        : "border-white/10 bg-ink-900/50 text-muted hover:border-white/20 hover:text-white"
                    )}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={opt}
                      checked={reason === opt}
                      onChange={() => {
                        setReason(opt);
                        setError(null);
                      }}
                      className="h-4 w-4 accent-[#00e0c6]"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="label" htmlFor="report-details">
                Additional details {reason === "Other" ? "(required)" : "(optional)"}
              </label>
              <textarea
                id="report-details"
                rows={3}
                maxLength={900}
                className="field"
                placeholder="Share any context that helps us review this report…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" disabled={reportMutation.isPending} onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={reportMutation.isPending}>
                {reportMutation.isPending ? "Submitting…" : "Submit report"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {modal === "block" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Block ${userName}`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !blockMutation.isPending) closeModal();
          }}
        >
          <div className="panel w-full max-w-sm space-y-4 bg-ink-800 p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-2xl">Block {userName}?</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeModal}
                className="rounded-lg p-1 text-muted transition hover:bg-white/5 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <p className="text-sm text-muted">
              You won&apos;t see each other in Discover or Messages anymore, and they won&apos;t be able to message you.
            </p>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" disabled={blockMutation.isPending} onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={blockMutation.isPending}
                onClick={() => blockMutation.mutate()}
                className="border-red-400/40 bg-red-500/15 text-red-300 hover:bg-red-500/25"
              >
                {blockMutation.isPending ? "Blocking…" : "Block user"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
