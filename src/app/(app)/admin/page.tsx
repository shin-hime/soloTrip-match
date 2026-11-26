"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { ReportStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type PendingAction =
  | { type: "reactivate"; userId: number; userName: string }
  | { type: "suspend"; userId: number; reportId: number; userName: string };

const statusStyle: Record<ReportStatus, string> = {
  open: "text-amber-300 border-amber-300/40",
  reviewing: "text-sky-300 border-sky-300/40",
  resolved: "text-brand border-brand/40",
  dismissed: "text-muted border-white/10",
};

const TABS: { key: "all" | ReportStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "reviewing", label: "Reviewing" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];

export default function AdminPage() {
  const qc = useQueryClient();
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role?.toLowerCase() === "admin";
  const [tab, setTab] = useState<"all" | ReportStatus>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: api.adminReports,
    enabled: isAdmin,
  });

  const refresh = () => {
    setActionError(null);
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const setStatus = useMutation({
    mutationFn: (v: { id: number; status: ReportStatus }) => api.adminUpdateReport(v.id, v.status),
    onSuccess: refresh,
    onError: (e: Error) => setActionError(e.message || "Couldn't update report status."),
  });

  const accountAction = useMutation({
    mutationFn: async (action: PendingAction) => {
      if (action.type === "reactivate") {
        await api.adminSetUserActive(action.userId, true);
      } else {
        await api.adminSetUserActive(action.userId, false);
        await api.adminUpdateReport(action.reportId, "resolved");
      }
    },
    onSuccess: () => {
      setPendingAction(null);
      setModalError(null);
      refresh();
    },
    onError: (e: Error) => setModalError(e.message || "Couldn't update account status."),
  });

  const list = Array.isArray(reports.data) ? reports.data : [];
  const filtered = useMemo(
    () => (tab === "all" ? list : list.filter((r) => r.status === tab)),
    [list, tab]
  );

  if (!isAdmin) return <p className="text-sm text-muted">You need an admin account to view moderation.</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Moderation</h1>
          <p className="mt-1 text-sm text-muted">Review reports and take action on accounts.</p>
        </div>
        <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => reports.refetch()} disabled={reports.isFetching}>
          {reports.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter reports by status">
        {TABS.map((t) => {
          const count = t.key === "all" ? list.length : list.filter((r) => r.status === t.key).length;
          return (
            <Chip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label} ({count})
            </Chip>
          );
        })}
      </div>

      {actionError && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {actionError}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {reports.isLoading && <p className="text-sm text-muted">Loading reports…</p>}
        {reports.isError && (
          <div role="alert" className="panel flex items-center justify-between gap-4 border-red-400/30 p-4 text-sm text-red-400">
            <span>{(reports.error as Error)?.message || "Couldn't load reports."}</span>
            <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => reports.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {reports.isSuccess && filtered.length === 0 && (
          <p className="text-sm text-muted">
            {tab === "all" ? "No reports to review." : `No ${tab} reports.`}
          </p>
        )}
        {filtered.map((r) => (
          <article key={r.report_id} className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold">{r.reported_name ?? `User ${r.reported_user_id}`}</span>
                {r.reported_active === false && (
                  <span className="ml-2 rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 text-[11px] text-red-300">
                    Suspended
                  </span>
                )}{" "}
                <span className="text-muted">
                  reported by {r.reporter_name ?? `User ${r.reporter_id}`} · {timeAgo(r.created_at)}
                </span>
              </p>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs capitalize", statusStyle[r.status])}>
                {r.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">{r.reason}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.report_id, status: "reviewing" })}>
                Start review
              </Button>
              <Button variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.report_id, status: "dismissed" })}>
                Dismiss
              </Button>
              <Button variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.report_id, status: "resolved" })}>
                Mark resolved
              </Button>
              {r.reported_active === false ? (
                <Button
                  variant="ghost"
                  disabled={accountAction.isPending}
                  className="text-brand hover:text-brand/80"
                  onClick={() => {
                    setModalError(null);
                    setPendingAction({
                      type: "reactivate",
                      userId: r.reported_user_id,
                      userName: r.reported_name ?? `User ${r.reported_user_id}`,
                    });
                  }}
                >
                  Reactivate account
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  disabled={accountAction.isPending}
                  className="text-red-400 hover:text-red-300"
                  onClick={() => {
                    setModalError(null);
                    setPendingAction({
                      type: "suspend",
                      userId: r.reported_user_id,
                      reportId: r.report_id,
                      userName: r.reported_name ?? `User ${r.reported_user_id}`,
                    });
                  }}
                >
                  Suspend account
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>

      {pendingAction && (
        <ConfirmModal
          open
          variant={pendingAction.type === "suspend" ? "danger" : "primary"}
          title={pendingAction.type === "suspend" ? "Suspend account?" : "Reactivate account?"}
          description={
            pendingAction.type === "suspend"
              ? `This will suspend ${pendingAction.userName}'s account and mark this report as resolved.`
              : `This will restore ${pendingAction.userName}'s access to TravelMate.`
          }
          confirmLabel={pendingAction.type === "suspend" ? "Suspend" : "Reactivate"}
          loadingLabel={pendingAction.type === "suspend" ? "Suspending..." : "Reactivating..."}
          isLoading={accountAction.isPending}
          error={modalError}
          onConfirm={() => accountAction.mutate(pendingAction)}
          onClose={() => {
            if (!accountAction.isPending) {
              setPendingAction(null);
              setModalError(null);
            }
          }}
        />
      )}
    </div>
  );
}
