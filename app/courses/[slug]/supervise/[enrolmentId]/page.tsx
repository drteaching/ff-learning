import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  requireAuth,
  getCourseBySlug,
  getUserProfile,
} from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { loadLogbookBundle } from "@/lib/learning/logbook-data";
import { ProgressDashboard } from "@/components/logbook-progress";
import { SignoffForm } from "@/components/signoff-form";
import { levelLabel } from "@/lib/learning/logbook";

type Props = {
  params: Promise<{ slug: string; enrolmentId: string }>;
};

export default async function SuperviseLearnerPage({ params }: Props) {
  const { slug, enrolmentId } = await params;
  const user = await requireAuth(`/courses/${slug}/supervise/${enrolmentId}`);
  const profile = await getUserProfile(user.id);
  const course = await getCourseBySlug(slug);

  if (!course) redirect("/");
  if (!profile || (profile.role !== "supervisor" && profile.role !== "admin")) {
    redirect(`/courses/${slug}`);
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("supervisor_assignments")
    .select("learner_enrolment_id")
    .eq("supervisor_user_id", user.id)
    .eq("learner_enrolment_id", enrolmentId)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id, course_id, track_id, status")
    .eq("id", enrolmentId)
    .maybeSingle();

  if (!enrolment || enrolment.course_id !== course.id) notFound();

  const bundle = await loadLogbookBundle(enrolment.id, enrolment.track_id);
  if (!bundle) notFound();

  const epaTitle = new Map(
    bundle.epas.map((e) => [e.id, `EPA ${e.number} · ${e.title}`] as const),
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <nav className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link
          href={`/courses/${slug}/supervise`}
          className="text-ff-primary-2 hover:underline"
        >
          ← Assigned learners
        </Link>
        <a
          href={`/api/courses/${slug}/logbook/export?enrolmentId=${enrolmentId}`}
          className="font-medium text-ff-primary hover:underline"
        >
          Download PDF
        </a>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Supervisor review
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">
        {bundle.learner?.display_name || bundle.learner?.email || "Learner"}
      </h1>
      <p className="mt-1 text-sm text-ff-muted">
        {bundle.learner?.email} · {bundle.track?.label} track
      </p>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl text-ff-ink">Progress</h2>
        <ProgressDashboard progress={bundle.progress} />
      </section>

      <section className="mt-12">
        <SignoffForm
          enrolmentId={enrolmentId}
          courseSlug={slug}
          epas={bundle.epas}
          existingSignoffs={bundle.signoffs}
        />
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ff-ink">Learner entries</h2>
        <ul className="mt-4 space-y-3">
          {bundle.entries.map((e) => (
            <li
              key={e.id}
              className="border border-ff-border bg-ff-card px-4 py-3 text-sm"
            >
              <p className="font-semibold text-ff-ink">
                {e.entry_date} · {epaTitle.get(e.epa_id)} ·{" "}
                {levelLabel(e.self_level)}
              </p>
              <p className="mt-1 text-ff-muted">{e.setting}</p>
              <p className="mt-1 text-ff-text">{e.description}</p>
            </li>
          ))}
          {bundle.entries.length === 0 && (
            <li className="text-sm text-ff-muted">No entries yet.</li>
          )}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ff-ink">
          Sign-off history (immutable)
        </h2>
        <ul className="mt-4 space-y-3">
          {bundle.signoffs.map((s) => (
            <li
              key={s.id}
              className="border border-ff-border bg-ff-tint/40 px-4 py-3 text-sm"
            >
              <p className="font-semibold text-ff-ink">
                {epaTitle.get(s.epa_id)} · {levelLabel(s.level)}
              </p>
              <p className="mt-1 text-ff-muted">
                {s.supervisor?.display_name || s.supervisor?.email} ·{" "}
                {new Date(s.signed_at).toLocaleString()} · id {s.id.slice(0, 8)}…
              </p>
              {s.note && <p className="mt-1 text-ff-text">{s.note}</p>}
            </li>
          ))}
          {bundle.signoffs.length === 0 && (
            <li className="text-sm text-ff-muted">No sign-offs yet.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
