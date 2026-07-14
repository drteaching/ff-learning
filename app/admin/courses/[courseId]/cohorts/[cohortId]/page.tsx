import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { CohortAssignPanel } from "@/components/admin-cohort-assign";

type Props = { params: Promise<{ courseId: string; cohortId: string }> };

export default async function AdminCohortDetailPage({ params }: Props) {
  await requireAdmin();
  const { courseId, cohortId } = await params;
  const supabase = await createClient();

  const [{ data: course }, { data: cohort }] = await Promise.all([
    supabase.from("courses").select("id, title").eq("id", courseId).maybeSingle(),
    supabase
      .from("cohorts")
      .select("id, name, start_date, end_date, course_id")
      .eq("id", cohortId)
      .maybeSingle(),
  ]);

  if (!course || !cohort || cohort.course_id !== courseId) notFound();

  const { data: enrolments } = await supabase
    .from("enrolments")
    .select("id, user_id, cohort_id, status")
    .eq("course_id", courseId)
    .eq("status", "active");

  const userIds = [...new Set((enrolments ?? []).map((e) => e.user_id))];
  const { data: users } =
    userIds.length > 0
      ? await supabase
          .from("users")
          .select("id, email, display_name, role")
          .in("id", userIds)
      : {
          data: [] as {
            id: string;
            email: string;
            display_name: string | null;
            role: string;
          }[],
        };

  // Also load potential supervisors (admins + supervisors across platform)
  const { data: supervisorPool } = await supabase
    .from("users")
    .select("id, email, display_name, role")
    .in("role", ["admin", "supervisor"]);

  const userById = new Map((users ?? []).map((u) => [u.id, u] as const));

  const enrolmentOptions = (enrolments ?? []).map((e) => {
    const u = userById.get(e.user_id);
    return {
      id: e.id,
      label: u?.display_name || u?.email || e.user_id,
      inCohort: e.cohort_id === cohortId,
    };
  });

  const inCohortIds = (enrolments ?? [])
    .filter((e) => e.cohort_id === cohortId)
    .map((e) => e.id);

  const { data: assignments } =
    inCohortIds.length > 0
      ? await supabase
          .from("supervisor_assignments")
          .select("supervisor_user_id, learner_enrolment_id")
          .in("learner_enrolment_id", inCohortIds)
      : {
          data: [] as {
            supervisor_user_id: string;
            learner_enrolment_id: string;
          }[],
        };

  const supervisorIds = [
    ...new Set((assignments ?? []).map((a) => a.supervisor_user_id)),
  ];
  const missingSupIds = supervisorIds.filter(
    (id) => !(users ?? []).some((u) => u.id === id),
  );
  const { data: extraSup } =
    missingSupIds.length > 0
      ? await supabase
          .from("users")
          .select("id, email, display_name, role")
          .in("id", missingSupIds)
      : { data: [] as { id: string; email: string; display_name: string | null; role: string }[] };

  const allPeople = [...(users ?? []), ...(extraSup ?? []), ...(supervisorPool ?? [])];
  const peopleById = new Map(allPeople.map((u) => [u.id, u] as const));

  const assignmentRows = (enrolments ?? [])
    .filter((e) => e.cohort_id === cohortId)
    .map((e) => {
      const learner = peopleById.get(e.user_id);
      const sups = (assignments ?? [])
        .filter((a) => a.learner_enrolment_id === e.id)
        .map((a) => {
          const s = peopleById.get(a.supervisor_user_id);
          return {
            id: a.supervisor_user_id,
            label: s?.display_name || s?.email || a.supervisor_user_id,
          };
        });
      return {
        enrolmentId: e.id,
        learnerLabel: learner?.display_name || learner?.email || e.user_id,
        supervisors: sups,
      };
    });

  const supervisorOptions = (supervisorPool ?? []).map((s) => ({
    id: s.id,
    label: s.display_name || s.email,
    role: s.role,
  }));

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link
        href={`/admin/courses/${courseId}/cohorts`}
        className="text-sm text-ff-primary-2 hover:underline"
      >
        ← Cohorts
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        {course.title}
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">{cohort.name}</h1>
      <p className="mt-1 text-sm text-ff-muted">
        {cohort.start_date || "—"} → {cohort.end_date || "—"}
      </p>
      <a
        href={`/api/admin/cohorts/${cohortId}/export`}
        className="mt-4 inline-flex rounded-md border border-ff-border bg-ff-tint px-4 py-2 text-sm font-medium text-ff-primary hover:bg-ff-border/40"
      >
        Export cohort logbook PDFs (zip)
      </a>

      <div className="mt-8">
        <CohortAssignPanel
          courseId={courseId}
          cohortId={cohortId}
          enrolments={enrolmentOptions}
          supervisors={supervisorOptions}
          assignments={assignmentRows}
        />
      </div>
    </main>
  );
}
