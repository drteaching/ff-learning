import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { CreateCohortForm } from "@/components/admin-cohort-forms";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminCohortsPage({ params }: Props) {
  await requireAdmin();
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) notFound();

  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("id, name, start_date, end_date")
    .eq("course_id", courseId)
    .order("start_date", { ascending: false });

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/admin" className="text-sm text-ff-primary-2 hover:underline">
        ← Admin
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Cohorts
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">{course.title}</h1>
      <p className="mt-2 text-sm text-ff-muted">
        Create rotation intakes, assign learners and supervisors, export logbooks.
      </p>

      <div className="mt-8">
        <CreateCohortForm courseId={course.id} />
      </div>

      <ul className="mt-8 space-y-3">
        {(cohorts ?? []).map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-3 border border-ff-border bg-ff-card p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-display text-xl text-ff-ink">{c.name}</h2>
              <p className="text-sm text-ff-muted">
                {c.start_date || "—"} → {c.end_date || "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/courses/${courseId}/cohorts/${c.id}`}
                className="rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink"
              >
                Manage
              </Link>
              <a
                href={`/api/admin/cohorts/${c.id}/export`}
                className="rounded-md border border-ff-border bg-ff-tint px-4 py-2 text-sm font-medium text-ff-primary hover:bg-ff-border/40"
              >
                Export PDFs
              </a>
            </div>
          </li>
        ))}
        {(cohorts ?? []).length === 0 && (
          <li className="text-sm text-ff-muted">No cohorts yet.</li>
        )}
      </ul>
    </main>
  );
}
