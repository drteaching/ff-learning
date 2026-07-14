import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadLogbookBundle } from "@/lib/learning/logbook-data";
import { buildLogbookPdf } from "@/lib/learning/logbook-pdf";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const url = new URL(request.url);
  const enrolmentId = url.searchParams.get("enrolmentId");

  if (!enrolmentId) {
    return NextResponse.json(
      { error: "enrolmentId query param required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id, user_id, course_id, track_id, status")
    .eq("id", enrolmentId)
    .maybeSingle();

  if (!enrolment || enrolment.course_id !== course.id) {
    return NextResponse.json({ error: "Enrolment not found" }, { status: 404 });
  }

  const owns = enrolment.user_id === user.id;
  const { data: assignment } = await supabase
    .from("supervisor_assignments")
    .select("learner_enrolment_id")
    .eq("supervisor_user_id", user.id)
    .eq("learner_enrolment_id", enrolmentId)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  if (!owns && !assignment && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bundle = await loadLogbookBundle(enrolment.id, enrolment.track_id);
  if (!bundle) {
    return NextResponse.json({ error: "Could not load logbook" }, { status: 500 });
  }

  const epaTitles = new Map(
    bundle.epas.map((e) => [e.id, `EPA ${e.number} · ${e.title}`] as const),
  );

  const bytes = await buildLogbookPdf({
    courseTitle: course.title,
    learnerName:
      bundle.learner?.display_name || bundle.learner?.email || "Learner",
    learnerEmail: bundle.learner?.email || "",
    trackLabel: bundle.track?.label || "—",
    progress: bundle.progress,
    entries: bundle.entries,
    signoffs: bundle.signoffs,
    epaTitles,
  });

  const filename = `logbook-${slug}-${enrolmentId.slice(0, 8)}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
