import Link from "next/link";
import { requireAdmin } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHomePage() {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const [{ data: courses }, { count: pendingAccess }] = await Promise.all([
    supabase.from("courses").select("id, slug, title, published").order("title"),
    supabase
      .from("professional_profiles")
      .select("*", { count: "exact", head: true })
      .eq("verified", false),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Admin
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">Administration</h1>
      <p className="mt-2 text-sm text-ff-muted">
        Signed in as {profile.email} · role {profile.role}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/access"
          className="border border-ff-border bg-ff-card p-5 hover:bg-ff-tint"
        >
          <h2 className="font-display text-xl text-ff-ink">Professional access</h2>
          <p className="mt-1 text-sm text-ff-muted">
            Approve AHPRA / student ID requests
            {pendingAccess ? ` · ${pendingAccess} pending` : ""}
          </p>
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ff-ink">Courses</h2>
        <ul className="mt-4 space-y-3">
          {(courses ?? []).map((c) => (
            <li
              key={c.id}
              className="border border-ff-border bg-ff-card p-5"
            >
              <h3 className="font-display text-lg text-ff-ink">{c.title}</h3>
              <p className="text-xs text-ff-muted">
                {c.slug}
                {c.published ? " · published" : " · draft"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Link
                  href={`/admin/courses/${c.id}/codes`}
                  className="rounded-md bg-ff-primary px-3 py-1.5 font-semibold text-white hover:bg-ff-ink"
                >
                  Enrolment codes
                </Link>
                <Link
                  href={`/admin/courses/${c.id}/cohorts`}
                  className="rounded-md border border-ff-border bg-ff-tint px-3 py-1.5 font-medium text-ff-primary hover:bg-ff-border/40"
                >
                  Cohorts
                </Link>
                <Link
                  href={`/admin/courses/${c.id}/media`}
                  className="rounded-md border border-ff-border bg-ff-tint px-3 py-1.5 font-medium text-ff-primary hover:bg-ff-border/40"
                >
                  Media register
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
