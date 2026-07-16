import { requireAdmin } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import {
  BugReportsTable,
  type BugReportRow,
} from "@/components/admin/bug-reports-table";

const SCREENSHOT_BUCKET = "bug-screenshots";
const LIST_SIGNED_URL_TTL = 60 * 60; // 60 minutes

export const metadata = { title: "Bug reports" };

export default async function BugReportsPage() {
  await requireAdmin("/admin/bug-reports");
  const supabase = await createClient();

  const { data } = await supabase
    .from("bug_reports")
    .select(
      "id, created_at, reporter_email, reporter_role, report_type, severity, status, route, page_url, user_agent, viewport, app_version, doing_what, what_happened, expected, console_errors, network_errors, screenshot_path, github_issue_number, github_issue_url",
    )
    .order("created_at", { ascending: false });

  const reports = (data ?? []) as BugReportRow[];

  // Pre-generate short-lived signed URLs for any screenshots (shown on expand).
  const paths = reports
    .map((r) => r.screenshot_path)
    .filter((p): p is string => Boolean(p));
  const screenshotUrls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .createSignedUrls(paths, LIST_SIGNED_URL_TTL);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) screenshotUrls[s.path] = s.signedUrl;
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Admin
      </p>
      <h1 className="mt-1 font-display text-3xl text-ff-ink">Bug reports</h1>
      <p className="mt-2 text-sm text-ff-muted">
        Reports and design suggestions filed from the in-app widget. Escalate to
        create a GitHub issue for the Claude agent.
      </p>

      <BugReportsTable reports={reports} screenshotUrls={screenshotUrls} />
    </main>
  );
}
