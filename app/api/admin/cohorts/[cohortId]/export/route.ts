import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { loadLogbookBundle } from "@/lib/learning/logbook-data";
import { buildLogbookPdf } from "@/lib/learning/logbook-pdf";

type Params = { params: Promise<{ cohortId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { cohortId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, name, course_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("id", cohort.course_id)
    .maybeSingle();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { data: enrolments } = await supabase
    .from("enrolments")
    .select("id, track_id, user_id")
    .eq("cohort_id", cohortId)
    .eq("status", "active");

  if (!enrolments?.length) {
    return NextResponse.json(
      { error: "No active enrolments in this cohort." },
      { status: 400 },
    );
  }

  const zip = new JSZip();

  for (const enrolment of enrolments) {
    const bundle = await loadLogbookBundle(enrolment.id, enrolment.track_id);
    if (!bundle) continue;

    const epaTitles = new Map(
      bundle.epas.map((e) => [e.id, `EPA ${e.number} · ${e.title}`] as const),
    );

    const bytes = await buildLogbookPdf({
      courseTitle: `${course.title} · ${cohort.name}`,
      learnerName:
        bundle.learner?.display_name || bundle.learner?.email || "Learner",
      learnerEmail: bundle.learner?.email || "",
      trackLabel: bundle.track?.label || "—",
      progress: bundle.progress,
      entries: bundle.entries,
      signoffs: bundle.signoffs,
      epaTitles,
    });

    const safeName = (
      bundle.learner?.display_name ||
      bundle.learner?.email ||
      enrolment.id
    )
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 60);

    zip.file(`logbook-${safeName}-${enrolment.id.slice(0, 8)}.pdf`, bytes);
  }

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  const filename = `cohort-${cohort.name.replace(/[^\w.\-]+/g, "_")}-logbooks.zip`;

  return new NextResponse(Buffer.from(zipBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
