"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";

export type BugReportRow = {
  id: string;
  created_at: string;
  reporter_email: string | null;
  reporter_role: string | null;
  report_type: "bug" | "design_suggestion";
  severity: string;
  status: string;
  route: string | null;
  page_url: string | null;
  user_agent: string | null;
  viewport: string | null;
  app_version: string | null;
  doing_what: string;
  what_happened: string;
  expected: string | null;
  console_errors: unknown;
  network_errors: unknown;
  screenshot_path: string | null;
  github_issue_number: number | null;
  github_issue_url: string | null;
};

type Filter = "all" | "bug" | "design_suggestion";

function fmtDate(iso: string): string {
  // Deterministic UTC formatting (avoids SSR/client hydration mismatch).
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function severityClasses(sev: string): string {
  switch (sev) {
    case "blocking":
    case "high":
      return "bg-ff-amber-tint text-ff-amber";
    case "medium":
      return "bg-ff-tint text-ff-primary";
    default:
      return "bg-ff-tint text-ff-muted";
  }
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function BugReportsTable({
  reports,
  screenshotUrls,
}: {
  reports: BugReportRow[];
  screenshotUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(null);

  const visible = reports.filter((r) => filter === "all" || r.report_type === filter);

  async function escalate(id: string) {
    setErrorId(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/bug-report/${id}/escalate`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        issueUrl?: string;
      };
      if (!res.ok) {
        setErrorId({ id, message: data.error || "Escalation failed." });
        return;
      }
      router.refresh();
    } catch {
      setErrorId({ id, message: "Escalation failed. Please try again." });
    } finally {
      setBusyId(null);
    }
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "bug", label: "Bugs" },
    { key: "design_suggestion", label: "Design" },
  ];

  return (
    <div className="mt-6">
      <div className="mb-3 inline-flex rounded-md border border-ff-border bg-ff-tint p-0.5 text-xs font-semibold">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded px-3 py-1.5 transition ${
              filter === f.key
                ? "bg-ff-card text-ff-ink shadow-sm"
                : "text-ff-muted hover:text-ff-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-ff-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-ff-tint text-xs uppercase tracking-wide text-ff-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Filed</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Reporter</th>
              <th className="px-3 py-2 font-semibold">Severity</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Route</th>
              <th className="px-3 py-2 font-semibold">What happened</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ff-muted">
                  No reports.
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const isOpen = expanded === r.id;
              const canEscalate = r.status === "new" || r.status === "triaged";
              const shotUrl = r.screenshot_path ? screenshotUrls[r.screenshot_path] : null;
              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="cursor-pointer border-t border-ff-border hover:bg-ff-tint/50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-ff-muted">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className="bg-ff-tint text-ff-primary-2">
                        {r.report_type === "design_suggestion" ? "Design" : "Bug"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-ff-text">
                      {r.reporter_email ?? "—"}
                      <span className="ml-1 text-xs text-ff-muted">({r.reporter_role ?? "?"})</span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={severityClasses(r.severity)}>{r.severity}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {r.github_issue_url ? (
                        <a
                          href={r.github_issue_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-ff-primary underline"
                        >
                          {r.status} #{r.github_issue_number}
                        </a>
                      ) : (
                        <Badge className="bg-ff-tint text-ff-muted">{r.status}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ff-muted">
                      {r.route ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-ff-text">
                      {r.what_happened.slice(0, 80)}
                      {r.what_happened.length > 80 ? "…" : ""}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-ff-border bg-ff-surface">
                      <td colSpan={7} className="px-4 py-4">
                        <Detail label="What they were doing" value={r.doing_what} />
                        <Detail label="What happened" value={r.what_happened} />
                        <Detail label="What they expected" value={r.expected ?? "—"} />
                        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-ff-muted sm:grid-cols-2">
                          <span>Page: <span className="text-ff-text">{r.page_url ?? "—"}</span></span>
                          <span>Viewport: <span className="text-ff-text">{r.viewport ?? "—"}</span></span>
                          <span>Commit: <span className="text-ff-text">{r.app_version ?? "—"}</span></span>
                          <span className="truncate">Browser: <span className="text-ff-text">{r.user_agent ?? "—"}</span></span>
                        </div>

                        {shotUrl && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-ff-ink">Screenshot</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={shotUrl}
                              alt="Report screenshot"
                              className="mt-1 max-h-96 rounded border border-ff-border"
                            />
                          </div>
                        )}

                        <ErrorBlock title="Console errors" value={r.console_errors} />
                        <ErrorBlock title="Network errors" value={r.network_errors} />

                        {errorId?.id === r.id && (
                          <p className="mt-3 rounded-md border border-ff-amber bg-ff-amber-tint px-3 py-2 text-sm text-ff-amber">
                            {errorId.message}
                          </p>
                        )}

                        {canEscalate && (
                          <button
                            type="button"
                            onClick={() => escalate(r.id)}
                            disabled={busyId === r.id}
                            className="mt-3 rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
                          >
                            {busyId === r.id ? "Escalating…" : "Escalate to Claude"}
                          </button>
                        )}
                        {r.github_issue_url && (
                          <p className="mt-3 text-sm text-ff-muted">
                            Escalated →{" "}
                            <a
                              href={r.github_issue_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-ff-primary underline"
                            >
                              issue #{r.github_issue_number}
                            </a>
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ff-muted">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-ff-text">{value}</p>
    </div>
  );
}

function ErrorBlock({ title, value }: { title: string; value: unknown }) {
  const arr = Array.isArray(value) ? value : [];
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-ff-ink">{title}</p>
      {arr.length === 0 ? (
        <p className="text-xs text-ff-muted">None recorded.</p>
      ) : (
        <pre className="mt-1 max-h-56 overflow-auto rounded border border-ff-border bg-ff-card p-2 text-xs text-ff-text">
          {JSON.stringify(arr, null, 2)}
        </pre>
      )}
    </div>
  );
}
