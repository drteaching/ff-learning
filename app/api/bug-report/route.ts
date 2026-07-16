import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SEVERITIES = new Set(["low", "medium", "high", "blocking"]);
const REPORT_TYPES = new Set(["bug", "design_suggestion"]);
const MAX_FIELD = 2000;
const MAX_ENTRIES = 20;

/** Truncate any string to MAX_FIELD chars; pass through non-strings/nullish. */
function trunc(value: unknown): string | null {
  if (value == null) return null;
  return String(value).slice(0, MAX_FIELD);
}

/** Cap an array of telemetry entries and truncate their string fields. */
function sanitiseEntries(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ENTRIES).map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = typeof v === "string" ? v.slice(0, MAX_FIELD) : v;
    }
    return out;
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const doingWhat = trunc(body.doingWhat);
  const whatHappened = trunc(body.whatHappened);
  if (!doingWhat?.trim() || !whatHappened?.trim()) {
    return NextResponse.json(
      { error: "The first two questions are required." },
      { status: 400 },
    );
  }

  const reportType = REPORT_TYPES.has(String(body.reportType))
    ? String(body.reportType)
    : "bug";
  const severity = SEVERITIES.has(String(body.severity))
    ? String(body.severity)
    : "medium";

  // Role is denormalised at capture time. Enum column → compare as text.
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const reporterRole = profile?.role ? String(profile.role) : "learner";

  // Only accept a screenshot path inside the caller's own folder.
  let screenshotPath: string | null = null;
  if (typeof body.screenshotPath === "string" && body.screenshotPath) {
    if (body.screenshotPath.startsWith(`${user.id}/`)) {
      screenshotPath = body.screenshotPath.slice(0, MAX_FIELD);
    } else {
      return NextResponse.json(
        { error: "Screenshot path does not belong to you." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("bug_reports")
    .insert({
      reporter_id: user.id,
      reporter_email: user.email ?? null,
      reporter_role: reporterRole,
      report_type: reportType,
      severity,
      doing_what: doingWhat,
      what_happened: whatHappened,
      expected: trunc(body.expected),
      page_url: trunc(body.pageUrl),
      route: trunc(body.route),
      user_agent: trunc(body.userAgent),
      viewport: trunc(body.viewport),
      app_version: trunc(body.appVersion),
      console_errors: sanitiseEntries(body.consoleErrors),
      network_errors: sanitiseEntries(body.networkErrors),
      screenshot_path: screenshotPath,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not save your report." },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
