import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { MediaRegisterManager } from "@/components/admin-media-manager";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminMediaPage({ params }: Props) {
  await requireAdmin();
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) notFound();

  const { data: rows } = await supabase
    .from("media_register")
    .select("id, asset_key, title, credit, licence, source_url, notes")
    .eq("course_id", courseId)
    .order("asset_key");

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/admin" className="text-sm text-ff-primary-2 hover:underline">
        ← Admin
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Media / figure credits
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">{course.title}</h1>
      <p className="mt-2 text-sm text-ff-muted">
        Licence register for teaching figures. Import the bundled spreadsheet or
        add rows manually.
      </p>
      <div className="mt-8">
        <MediaRegisterManager courseId={course.id} rows={rows ?? []} />
      </div>
    </main>
  );
}
