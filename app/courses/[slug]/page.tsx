import Link from "next/link";
import { requireCourseAccess } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

export default async function CourseOverviewPage({ params }: Props) {
  const { slug } = await params;
  const { course } = await requireCourseAccess(slug);
  const supabase = await createClient();

  const { data: modules } = await supabase
    .from("modules")
    .select("id, ordinal, title, summary")
    .eq("course_id", course.id)
    .order("ordinal");

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Course overview
      </p>
      <h1 className="mt-2 font-display text-4xl text-ff-ink">{course.title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-ff-text">
        {course.description}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/courses/${slug}/logbook`}
          className="rounded-md bg-ff-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-ff-ink"
        >
          EPA logbook
        </Link>
        <Link
          href={`/courses/${slug}/supervise`}
          className="rounded-md border border-ff-accent bg-ff-accent-tint px-4 py-2.5 text-sm font-semibold text-ff-ink hover:bg-ff-accent/30"
        >
          Supervise learners
        </Link>
        <Link
          href={`/courses/${slug}/quiz`}
          className="rounded-md border border-ff-border bg-ff-card px-4 py-2.5 text-sm font-medium text-ff-primary hover:bg-ff-tint"
        >
          Mixed exam
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-ff-border bg-ff-card px-4 py-2.5 text-sm font-medium text-ff-primary hover:bg-ff-tint"
        >
          Dashboard
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ff-ink">What the rotation is</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-ff-text">
          <p>
            A six-week clinical immersion in a working fertility unit, paired
            with a modular online library. You work through structured modules,
            test yourself with single-best-answer quizzes, and log EPA
            encounters for authenticated supervisor sign-off.
          </p>
          <p>
            Audience tracks — medical student, new-start doctor, and nurse —
            share the same eight EPAs with role-specific target levels. Content
            is de-identified teaching material; never enter patient-identifiable
            information.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ff-ink">Modules</h2>
        <ol className="mt-6 space-y-3">
          {(modules ?? []).map((mod) => (
            <li key={mod.id}>
              <div className="flex flex-col gap-3 border border-ff-border bg-ff-card p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ff-primary-2">
                    Module {mod.ordinal}
                  </p>
                  <h3 className="font-display text-xl text-ff-ink">
                    {mod.title}
                  </h3>
                  {mod.summary && (
                    <p className="mt-1 text-sm text-ff-muted">{mod.summary}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/courses/${slug}/modules/${mod.ordinal}`}
                    className="rounded-md bg-ff-primary px-3 py-2 text-sm font-semibold text-white hover:bg-ff-ink"
                  >
                    Read
                  </Link>
                  <Link
                    href={`/courses/${slug}/modules/${mod.ordinal}/quiz`}
                    className="rounded-md border border-ff-border bg-ff-tint px-3 py-2 text-sm font-medium text-ff-primary hover:bg-ff-border/40"
                  >
                    Quiz
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {(!modules || modules.length === 0) && (
          <p className="mt-4 text-sm text-ff-muted">
            Modules have not been seeded yet. Run{" "}
            <code className="rounded bg-ff-tint px-1.5 py-0.5 text-ff-ink">
              npm run seed:content
            </code>
            .
          </p>
        )}
      </section>
    </main>
  );
}
