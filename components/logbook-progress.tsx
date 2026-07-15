import { cn } from "@/lib/utils";
import { levelLabel, type EpaProgress } from "@/lib/learning/logbook";

export function ProgressDashboard({
  progress,
}: {
  progress?: EpaProgress[] | null;
}) {
  const rows = progress ?? [];

  if (rows.length === 0) {
    return (
      <p className="text-sm text-ff-muted">
        No EPA targets are configured for this track yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((p) => {
        if (!p) return null;
        const reached = p.signedPeak || p.selfPeak || 0;
        const pct = Math.min(100, (reached / 4) * 100);
        return (
          <div
            key={p.epaId}
            className="border border-ff-border bg-ff-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ff-primary-2">
                  EPA {p.number ?? "—"}
                </p>
                <h3 className="font-display text-base text-ff-ink">
                  {p.title ?? "Untitled EPA"}
                </h3>
              </div>
              <span className="shrink-0 text-xs text-ff-muted">
                target {levelLabel(p.targetLevel)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ff-tint">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  p.status === "target_met" && "bg-ff-green",
                  p.status === "working_toward" && "bg-ff-primary-2",
                  p.status === "not_started" && "bg-ff-border",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p
              className={cn(
                "mt-2 text-xs font-semibold",
                p.status === "target_met" && "text-ff-green",
                p.status === "working_toward" && "text-ff-amber",
                p.status === "not_started" && "text-ff-muted",
              )}
            >
              {p.status === "target_met" &&
                `Target met — signed ${levelLabel(p.signedPeak)}`}
              {p.status === "working_toward" &&
                (p.signedPeak
                  ? `Working toward — signed ${levelLabel(p.signedPeak)} (self ${p.selfPeak ? levelLabel(p.selfPeak) : "—"})`
                  : `Working toward — self ${levelLabel(p.selfPeak)} · awaiting sign-off`)}
              {p.status === "not_started" && "Not yet logged"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
