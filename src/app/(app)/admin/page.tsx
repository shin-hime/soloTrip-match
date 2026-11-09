"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import type { ReportStatus } from "@/types";
import { Button } from "@/components/ui/Button";

const statusStyle: Record<ReportStatus, string> = {
  open: "text-amber-300 border-amber-300/40",
  reviewing: "text-sky-300 border-sky-300/40",
  resolved: "text-brand border-brand/40",
  dismissed: "text-muted border-white/10",
};

export default function AdminPage() {
  const qc = useQueryClient();
  const role = useAuth((s) => s.user?.role);
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: api.adminReports, enabled: role === "admin" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-reports"] });
  const setStatus = useMutation({ mutationFn: (v: { id: number; status: ReportStatus }) => api.adminUpdateReport(v.id, v.status), onSuccess: refresh });
  const suspend = useMutation({ mutationFn: (userId: number) => api.adminSetUserActive(userId, false), onSuccess: refresh });

  if (role !== "admin") return <p className="text-sm text-muted">You need an admin account to view moderation.</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-serif text-4xl">Moderation</h1>
      <p className="mt-1 text-sm text-muted">Review reports and take action on accounts.</p>

      <div className="mt-6 space-y-3">
        {reports.isLoading && <p className="text-sm text-muted">Loading reports…</p>}
        {reports.isSuccess && reports.data.length === 0 && <p className="text-sm text-muted">No reports to review.</p>}
        {(reports.data ?? []).map((r) => (
          <article key={r.report_id} className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm"><span className="font-semibold">{r.reported_name ?? `User ${r.reported_user_id}`}</span> <span className="text-muted">reported by {r.reporter_name ?? `User ${r.reporter_id}`} · {timeAgo(r.created_at)}</span></p>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs capitalize", statusStyle[r.status])}>{r.status}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{r.reason}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStatus.mutate({ id: r.report_id, status: "reviewing" })}>Start review</Button>
              <Button variant="outline" onClick={() => setStatus.mutate({ id: r.report_id, status: "dismissed" })}>Dismiss</Button>
              <Button variant="outline" onClick={() => setStatus.mutate({ id: r.report_id, status: "resolved" })}>Mark resolved</Button>
              <Button variant="ghost" className="text-red-400 hover:text-red-300"
                onClick={() => { if (confirm("Suspend this account?")) { suspend.mutate(r.reported_user_id); setStatus.mutate({ id: r.report_id, status: "resolved" }); } }}>
                Suspend account
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
