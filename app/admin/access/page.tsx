import Link from "next/link";
import { requireAdmin } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { AccessApprovalList } from "@/components/admin-access-list";

export default async function AdminAccessPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("professional_profiles")
    .select("user_id, profession, ahpra_or_student_id, verified, verified_at")
    .order("verified", { ascending: true });

  const userIds = (profiles ?? []).map((p) => p.user_id);
  const { data: users } =
    userIds.length > 0
      ? await supabase
          .from("users")
          .select("id, email, display_name")
          .in("id", userIds)
      : { data: [] as { id: string; email: string; display_name: string | null }[] };

  const userById = new Map((users ?? []).map((u) => [u.id, u] as const));

  const rows = (profiles ?? []).map((p) => {
    const u = userById.get(p.user_id);
    return {
      userId: p.user_id,
      label: u?.display_name || u?.email || p.user_id,
      profession: p.profession,
      ahpraOrStudentId: p.ahpra_or_student_id,
      verified: p.verified,
      verifiedAt: p.verified_at,
    };
  });

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/admin" className="text-sm text-ff-primary-2 hover:underline">
        ← Admin
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Professional access
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">
        Approve access requests
      </h1>
      <p className="mt-2 text-sm text-ff-muted">
        Learners submit AHPRA or student IDs from their dashboard. Approve after
        checking credentials.
      </p>
      <div className="mt-8">
        <AccessApprovalList rows={rows} />
      </div>
    </main>
  );
}
