"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Calendar,
  Check,
  Clock,
  Flag,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  UserCheck,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, fmtRange, gradientFor } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const REPORT_REASONS = [
  "Harassment",
  "Spam",
  "Fake profile",
  "Inappropriate behavior",
  "Other",
] as const;

type ReportReason = (typeof REPORT_REASONS)[number];

export default function TravelerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const meId = useAuth((s) => s.user?.user_id);
  const targetId = Number(params.id);

  const [modal, setModal] = useState<"block" | "unblock" | "report" | null>(null);
  const [reason, setReason] = useState<ReportReason>("Harassment");
  const [details, setDetails] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (meId && targetId === meId) {
      router.replace("/profile");
    }
  }, [meId, targetId, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const profile = useQuery({
    queryKey: ["user-profile", targetId],
    queryFn: () => api.userProfile(targetId),
    enabled: Number.isInteger(targetId) && targetId > 0 && targetId !== meId,
  });

  const invalidateRelationship = () => {
    qc.invalidateQueries({ queryKey: ["user-profile", targetId] });
    qc.invalidateQueries({ queryKey: ["blocked-users"] });
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  };

  const closeModal = () => {
    setModal(null);
    setModalError(null);
    setReason("Harassment");
    setDetails("");
  };

  const sendRequest = useMutation({
    mutationFn: () => api.sendChatRequest(targetId),
    onSuccess: () => {
      invalidateRelationship();
      setToast("Chat request sent.");
    },
    onError: (e: Error) => setToast(e.message || "Couldn't send chat request."),
  });

  const blockMutation = useMutation({
    mutationFn: () => api.blockUser(targetId),
    onSuccess: () => {
      closeModal();
      invalidateRelationship();
      setToast("User blocked.");
    },
    onError: (e: Error) => setModalError(e.message || "Couldn't block user."),
  });

  const unblockMutation = useMutation({
    mutationFn: () => api.unblockUser(targetId),
    onSuccess: () => {
      closeModal();
      invalidateRelationship();
      setToast("User unblocked.");
    },
    onError: (e: Error) => setModalError(e.message || "Couldn't unblock user."),
  });

  const reportMutation = useMutation({
    mutationFn: (fullReason: string) => api.reportUser(targetId, fullReason),
    onSuccess: () => {
      closeModal();
      setToast("Report submitted. Thank you.");
    },
    onError: (e: Error) => setModalError(e.message || "Couldn't submit report."),
  });

  const submitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (reportMutation.isPending) return;
    const trimmed = details.trim();
    if (reason === "Other" && trimmed.length < 3) {
      setModalError("Please provide at least 3 characters describing the issue.");
      return;
    }
    const fullReason = trimmed ? `${reason}: ${trimmed}` : reason;
    if (fullReason.length > 1000) {
      setModalError("Details must be under 1000 characters.");
      return;
    }
    setModalError(null);
    reportMutation.mutate(fullReason);
  };

  if (meId && targetId === meId) return null;
  if (profile.isLoading) return <p className="text-sm text-muted">Loading traveler profile…</p>;
  if (profile.isError || !profile.data) {
    return (
      <div className="panel mx-auto max-w-md p-8 text-center">
        <p role="alert" className="text-sm text-red-400">
          {(profile.error as Error)?.message || "Couldn't load this traveler's profile."}
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
        >
          <ArrowLeft size={14} aria-hidden /> Go back
        </button>
      </div>
    );
  }

  const u = profile.data;

  const statusBadge = u.is_blocked
    ? { label: "Blocked", cls: "border-rose-400/40 bg-rose-500/15 text-rose-300" }
    : u.is_matched
      ? { label: "Matched", cls: "border-brand/40 bg-brand-soft text-brand" }
      : u.request_status === "sent"
        ? { label: "Request Sent", cls: "border-amber-300/40 bg-amber-500/15 text-amber-200" }
        : u.request_status === "received"
          ? { label: "Request Received", cls: "border-sky-300/40 bg-sky-500/15 text-sky-200" }
          : { label: "Not Connected", cls: "border-white/15 bg-white/5 text-muted" };

  const Row = ({ k, v }: { k: string; v: string | null }) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v ?? "—"}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-white"
      >
        <ArrowLeft size={16} aria-hidden /> Back
      </button>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-5">
          <section className="panel overflow-hidden">
            <div
              className="h-24"
              style={{
                background: u.cover_photo_url
                  ? `url(${u.cover_photo_url}) center/cover`
                  : gradientFor(u.origin_location ?? u.full_name),
              }}
            />
            <div className="px-5 pb-5">
              <div className="flex items-end justify-between gap-2">
                <Avatar
                  name={u.full_name}
                  src={u.avatar_url}
                  size={64}
                  className="-mt-8 rounded-2xl ring-2 ring-brand/60 [&>*]:rounded-2xl"
                />
                <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", statusBadge.cls)}>
                  {statusBadge.label}
                </span>
              </div>

              <h1 className="mt-3 flex items-center gap-1.5 text-lg font-bold">
                <span>
                  {u.full_name}
                  {u.age ? `, ${u.age}` : ""}
                </span>
                {u.is_verified && <BadgeCheck size={16} className="shrink-0 text-brand" aria-label="Verified" />}
              </h1>

              {u.origin_location && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <MapPin size={12} aria-hidden />
                  <span>{u.origin_location}</span>
                </p>
              )}

              <dl className="mt-4 flex gap-6 font-serif text-xl">
                {[
                  ["Trips", u.trips_count ?? 0],
                  ["Matches", u.matches_count ?? 0],
                ].map(([label, val]) => (
                  <div key={label as string}>
                    <dd>{val}</dd>
                    <dt className="font-sans text-[11px] text-muted">{label}</dt>
                  </div>
                ))}
              </dl>

              <div className="mt-5 space-y-2.5">
                {u.is_blocked ? (
                  <>
                    <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                      You have blocked {u.full_name}. Unblock them to reconnect in Discover or Messages.
                    </div>
                    <Button
                      type="button"
                      full
                      onClick={() => {
                        setModalError(null);
                        setModal("unblock");
                      }}
                      className="inline-flex items-center justify-center gap-1.5"
                    >
                      <UserCheck size={15} aria-hidden /> Unblock
                    </Button>
                  </>
                ) : (
                  <>
                    {u.is_matched ? (
                      <Link
                        href="/messages"
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-ink-950 shadow-glow transition hover:brightness-110"
                      >
                        <MessageCircle size={15} aria-hidden /> Message
                      </Link>
                    ) : u.request_status === "sent" ? (
                      <Button
                        type="button"
                        full
                        disabled
                        variant="outline"
                        className="inline-flex items-center justify-center gap-1.5"
                      >
                        <Clock size={15} aria-hidden /> Request Sent
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        full
                        disabled={sendRequest.isPending}
                        onClick={() => sendRequest.mutate()}
                        className="inline-flex items-center justify-center gap-1.5"
                      >
                        {u.request_status === "received" ? (
                          <>
                            <Check size={15} aria-hidden />
                            {sendRequest.isPending ? "Connecting…" : "Accept Chat Request"}
                          </>
                        ) : (
                          <>
                            <Send size={15} aria-hidden />
                            {sendRequest.isPending ? "Sending…" : "Send Chat Request"}
                          </>
                        )}
                      </Button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setModalError(null);
                          setModal("report");
                        }}
                        className="inline-flex items-center justify-center gap-1.5 text-xs"
                      >
                        <Flag size={13} className="text-amber-300" aria-hidden /> Report
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setModalError(null);
                          setModal("block");
                        }}
                        className="inline-flex items-center justify-center gap-1.5 border-rose-400/30 text-xs text-rose-300 hover:bg-rose-500/15"
                      >
                        <Ban size={13} aria-hidden /> Block
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel p-5">
            <h2 className="mb-2 text-sm font-semibold">About</h2>
            <p className="text-sm text-muted">{u.bio ?? "This traveler hasn't added a bio yet."}</p>
          </section>

          <section className="panel p-5">
            <h2 className="mb-2 text-sm font-semibold">Travel style & details</h2>
            <Row k="Style" v={(u.travel_styles ?? []).join(" · ") || null} />
            <Row k="Budget" v={u.budget_range} />
            {u.contact_info && (
              <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Mail size={13} aria-hidden /> Contact
                </span>
                <span>{u.contact_info}</span>
              </div>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {(u.interests ?? []).length > 0 ? (
                u.interests.map((i) => (
                  <Chip key={i} active>
                    {i}
                  </Chip>
                ))
              ) : (
                <p className="text-sm text-muted">No interests listed.</p>
              )}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="mb-3 text-sm font-semibold text-brand">Upcoming trips</h2>
            {u.trips.length === 0 ? (
              <p className="text-sm text-muted">No upcoming open trips right now.</p>
            ) : (
              <div className="space-y-3">
                {u.trips.map((t) => (
                  <div
                    key={t.trip_id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-semibold">{t.destination}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <Calendar size={12} aria-hidden />
                        <span>{fmtRange(t.departure_date, t.return_date)}</span>
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted">
                      {t.budget_usd ? <p className="font-semibold text-white">${t.budget_usd}</p> : null}
                      <p>
                        Looking for {t.looking_for_count} companion{t.looking_for_count > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {modal === "block" && (
        <ConfirmModal
          open
          variant="danger"
          title={`Block ${u.full_name}?`}
          description="You won't see each other in Discover or Messages anymore, and they won't be able to message you."
          confirmLabel="Block user"
          loadingLabel="Blocking..."
          isLoading={blockMutation.isPending}
          error={modalError}
          onConfirm={() => blockMutation.mutate()}
          onClose={closeModal}
        />
      )}

      {modal === "unblock" && (
        <ConfirmModal
          open
          variant="primary"
          title={`Unblock ${u.full_name}?`}
          description={`This will allow ${u.full_name} to appear in Discover and Messages again.`}
          confirmLabel="Unblock"
          loadingLabel="Unblocking..."
          isLoading={unblockMutation.isPending}
          error={modalError}
          onConfirm={() => unblockMutation.mutate()}
          onClose={closeModal}
        />
      )}

      {modal === "report" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Report ${u.full_name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !reportMutation.isPending) closeModal();
          }}
        >
          <form onSubmit={submitReport} className="panel w-full max-w-md space-y-4 bg-ink-800 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">Report {u.full_name}</h2>
                <p className="mt-1 text-xs text-muted">Reports are reviewed by our moderation team.</p>
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
                      name="profile-report-reason"
                      value={opt}
                      checked={reason === opt}
                      onChange={() => {
                        setReason(opt);
                        setModalError(null);
                      }}
                      className="h-4 w-4 accent-[#00e0c6]"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="label" htmlFor="profile-report-details">
                Additional details {reason === "Other" ? "(required)" : "(optional)"}
              </label>
              <textarea
                id="profile-report-details"
                rows={3}
                maxLength={900}
                className="field"
                placeholder="Share any context that helps us review this report…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            {modalError && (
              <p role="alert" className="text-sm text-rose-400">
                {modalError}
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

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-brand/40 bg-ink-800 px-4 py-2 text-sm shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
