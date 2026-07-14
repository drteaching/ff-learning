import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth, getCourseBySlug, getUserProfile } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

export default async function SuperviseListPage({ params }: Props) {
  const { slug } = await params;
  const user = await requireAuth(`/courses/${slug}/supervise`);
  const profile = await getUserProfile(user.id);
  const course = await getCourseBySlug(slug);

  if (!course) redirect("/");

  if (!profile || (profile.role !== "supervisor" && profile.role !== "admin")) {
    redirect(`/courses/${slug}`);
  }

  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from("supervisor_assignments")
    .select("learner_enrolment_id")
    .eq("supervisor_user_id", user.id);

  const enrolmentIds = (assignments ?? []).map((a) => a.learner_enrolment_id);

  const { data: enrolments } =
    enrolmentIds.length > 0
      ? await supabase
          .from("enrolments")
          .select("id, status, user_id, course_id, track_id")
          .in("id", enrolmentIds)
          .eq("course_id", course.id)
          .eq("status", "active")
      : { data: [] as { id: string; status: string; user_id: string; course_id: string; track_id: string }[] };

  const userIds = (enrolments ?? []).map((e) => e.user_id);
  const { data: learners } =
    userIds.length > 0
      ? await supabase
          .from("users")
          .select("id, email, display_name")
          .in("id", userIds)
      : { data: [] as { id: string; email: string; display_name: string | null }[] };

  const learnerById = new Map((learners ?? []).map((l) => [l.id, l] as const));

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href={`/courses/${slug}`} className="text-sm text-ff-primary-2 hover:underline">
        ← Course overview
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Supervisor
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">Assigned learners</h1>
      <p className="mt-2 text-sm text-ff-muted">
        {course.title} · review entries and record immutable sign-offs
      </p>

      <ul className="mt-8 space-y-3">
        {(enrolments ?? []).map((e) => {
          const learner = learnerById.get(e.user_id);
          return (
            <li
              key={e.id}
              className="flex flex-col gap-3 border border-ff-border bg-ff-card p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h2 className="font-display text-xl text-ff-ink">
                  {learner?.display_name || learner?.email || "Learner"}
                </h2>
                <p className="text-sm text-ff-muted">{learner?.email}</p>
              </div>
              <Link
                href={`/courses/${slug}/supervise/${e.id}`}
                className="rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink"
              >
                Review &amp; sign off
              </Link>
            </li>
          );
        })}
        {(enrolments ?? []).length === 0 && (
          <li className="border border-dashed border-ff-border bg-ff-tint/40 p-8 text-center text-sm text-ff-muted">
            No learners assigned to you for this course yet.
          </li>
        )}
      </ul>
    </main>
  );
}
