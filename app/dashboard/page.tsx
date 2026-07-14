import Link from "next/link";
import { requireAuth } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { RequestAccessForm } from "@/components/request-access-form";

export default async function DashboardPage() {
  const user = await requireAuth("/dashboard");
  const supabase = await createClient();

  const [{ data: enrolments }, { data: profile }] = await Promise.all([
    supabase
      .from("enrolments")
      .select("id, status, course_id, courses(slug, title)")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("professional_profiles")
      .select("profession, ahpra_or_student_id, verified")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Learner dashboard
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">Your courses</h1>
      <p className="mt-2 text-sm text-ff-muted">
        Signed in as {user.email}. Open a course to use the EPA logbook and
        quizzes.
      </p>

      <div className="mt-8 max-w-lg">
        <RequestAccessForm existing={profile} />
      </div>

      <ul className="mt-10 space-y-3">
        {(enrolments ?? []).map((e) => {
          const course = e.courses as unknown as {
            slug: string;
            title: string;
          } | null;
          if (!course) return null;
          return (
            <li
              key={e.id}
              className="flex flex-col gap-3 border border-ff-border bg-ff-card p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h2 className="font-display text-xl text-ff-ink">
                  {course.title}
                </h2>
                <p className="text-sm text-ff-muted">Active enrolment</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/courses/${course.slug}`}
                  className="rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink"
                >
                  Open course
                </Link>
                <Link
                  href={`/courses/${course.slug}/logbook`}
                  className="rounded-md border border-ff-border bg-ff-tint px-4 py-2 text-sm font-medium text-ff-primary hover:bg-ff-border/40"
                >
                  Logbook
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {(!enrolments || enrolments.length === 0) && (
        <div className="mt-8 border border-dashed border-ff-border bg-ff-tint/50 p-8 text-center">
          <p className="text-ff-text">No active enrolments yet.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-medium text-ff-primary hover:underline"
          >
            Browse the catalogue
          </Link>
        </div>
      )}
    </main>
  );
}
