import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getActiveEnrolment } from "@/lib/learning/access";

const COMING_SOON = [
  {
    title: "GAMSAT preparation",
    blurb: "Structured science and reasoning prep for medical school entry.",
  },
  {
    title: "USMLE prep",
    blurb: "Step-focused content for international medical graduates.",
  },
  {
    title: "O&G prep",
    blurb: "Obstetrics and gynaecology revision for exams and clinical work.",
  },
];

export default async function CataloguePage() {
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, slug, title, description")
    .eq("published", true)
    .order("title");

  const user = await getAuthUser();
  const enrolmentByCourse = new Map<string, boolean>();

  if (user && courses?.length) {
    await Promise.all(
      courses.map(async (c) => {
        const e = await getActiveEnrolment(c.id, user.id);
        enrolmentByCourse.set(c.id, Boolean(e));
      }),
    );
  }

  return (
    <main>
      <section className="relative overflow-hidden bg-gradient-to-br from-ff-ink via-ff-primary to-[#1a5f9e] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, var(--ff-accent) 0, transparent 35%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.25) 0, transparent 28%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ff-accent">
            Flinders Fertility · Education Program
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl leading-tight text-white sm:text-5xl">
            Clinical Rotation in Reproductive Medicine
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">
            A multi-course learning home for medical students, new-start
            doctors, and nurses — modules, quizzes, and an EPA clinical
            logbook.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="font-display text-2xl text-ff-ink">Course catalogue</h2>
        <p className="mt-1 text-ff-muted">
          Enrolable courses and what&apos;s coming next.
        </p>

        <div className="mt-8 space-y-4">
          {(courses ?? []).map((course) => {
            const enrolled = enrolmentByCourse.get(course.id);
            return (
              <article
                key={course.id}
                className="border border-ff-border bg-ff-card p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ff-accent">
                      Available now
                    </p>
                    <h3 className="mt-1 font-display text-2xl text-ff-ink">
                      {course.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ff-text">
                      {course.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {user && enrolled ? (
                      <Link
                        href={`/courses/${course.slug}`}
                        className="inline-flex items-center justify-center rounded-md bg-ff-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-ff-ink"
                      >
                        Continue course
                      </Link>
                    ) : user ? (
                      <>
                        <Link
                          href={`/courses/${course.slug}/enrol`}
                          className="inline-flex items-center justify-center rounded-md bg-ff-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-ff-ink"
                        >
                          Enrol
                        </Link>
                        <p className="text-xs text-ff-muted">
                          Requires an enrolment code
                        </p>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`/auth/login?next=${encodeURIComponent(`/courses/${course.slug}/enrol`)}`}
                          className="inline-flex items-center justify-center rounded-md bg-ff-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-ff-ink"
                        >
                          Sign in to enrol
                        </Link>
                        <Link
                          href="/auth/sign-up"
                          className="text-center text-sm text-ff-primary-2 hover:underline"
                        >
                          Create an account
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {COMING_SOON.map((item) => (
            <article
              key={item.title}
              className="border border-dashed border-ff-border bg-ff-tint/40 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ff-muted">
                    Coming soon
                  </p>
                  <h3 className="mt-1 font-display text-xl text-ff-ink/70">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-ff-muted">{item.blurb}</p>
                </div>
                <span className="shrink-0 rounded-full bg-ff-amber-tint px-3 py-1 text-xs font-semibold text-ff-amber">
                  Coming soon
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
