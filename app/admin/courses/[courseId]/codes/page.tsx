import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { AdminCodesManager } from "@/components/admin-codes-manager";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminCourseCodesPage({ params }: Props) {
  await requireAdmin();
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) notFound();

  const [{ data: tracks }, { data: codes }] = await Promise.all([
    supabase
      .from("audience_tracks")
      .select("id, key, label")
      .eq("course_id", courseId)
      .order("key"),
    supabase
      .from("enrolment_codes")
      .select("id, code, track_id, max_uses, uses, expires_at, is_active")
      .eq("course_id", courseId)
      .order("code"),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/admin" className="text-sm text-ff-primary-2 hover:underline">
        ← Admin
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Enrolment codes
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">{course.title}</h1>
      <p className="mt-2 text-sm text-ff-muted">
        Create codes for self-enrolment. Optionally lock a code to an audience
        track, max uses, and expiry.
      </p>
      <div className="mt-8">
        <AdminCodesManager
          courseId={course.id}
          tracks={tracks ?? []}
          codes={codes ?? []}
        />
      </div>
    </main>
  );
}
