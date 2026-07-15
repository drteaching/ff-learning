import Link from "next/link";
import { requireCourseAccess } from "@/lib/learning/access";
import { loadLogbookBundle } from "@/lib/learning/logbook-data";
import { ProgressDashboard } from "@/components/logbook-progress";
import { LogbookEntryForm } from "@/components/logbook-entry-form";
import { EpaLevelDescriptors } from "@/components/epa-level-descriptors";
import { levelLabel } from "@/lib/learning/logbook";

type Props = { params: Promise<{ slug: string }> };

export default async function LearnerLogbookPage({ params }: Props) {
  const { slug } = await params;
  const { course, enrolment } = await requireCourseAccess(slug);
  const bundle = await loadLogbookBundle(enrolment.id, enrolment.track_id);

  if (!bundle) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-ff-muted">Could not load logbook.</p>
      </main>
    );
  }

  const epaTitle = new Map(
    (bundle.epas ?? []).map(
      (e) => [e.id, `EPA ${e.number ?? "—"} · ${e.title ?? "Untitled"}`] as const,
    ),
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <nav className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link href={`/courses/${slug}`} className="text-ff-primary-2 hover:underline">
          ← Course overview
        </Link>
        <a
          href={`/api/courses/${slug}/logbook/export?enrolmentId=${enrolment.id}`}
          className="font-medium text-ff-primary hover:underline"
        >
          Download PDF
        </a>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        EPA clinical logbook
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink sm:text-4xl">
        Progress &amp; encounters
      </h1>
      <p className="mt-2 text-sm text-ff-muted">
        Track: {bundle.track?.label ?? "—"} · Targets are role-specific.{" "}
        <strong className="text-ff-ink">Target met</strong> is based on
        supervisor-confirmed sign-offs.
      </p>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl text-ff-ink">
          Progress at a glance
        </h2>
        <ProgressDashboard progress={bundle.progress} />
      </section>

      {(bundle.epas ?? []).length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl text-ff-ink">EPA reference</h2>
          <ul className="mt-4 space-y-4">
            {(bundle.epas ?? []).map((epa) => {
              const target = (bundle.targets ?? []).find(
                (t) => t?.epa_id === epa.id,
              );
              return (
                <li
                  key={epa.id}
                  className="border border-ff-border bg-ff-card px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-ff-ink">
                      EPA {epa.number ?? "—"} · {epa.title ?? "Untitled"}
                    </p>
                    <span className="text-xs text-ff-muted">
                      Target {levelLabel(target?.target_level)}
                    </span>
                  </div>
                  {epa.definition ? (
                    <p className="mt-1 text-sm text-ff-text">{epa.definition}</p>
                  ) : null}
                  <EpaLevelDescriptors descriptors={epa.level_descriptors} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <LogbookEntryForm
          enrolmentId={enrolment.id}
          courseSlug={slug}
          epas={bundle.epas ?? []}
        />
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ff-ink">Your entries</h2>
        <ul className="mt-4 space-y-3">
          {(bundle.entries ?? []).map((e) => (
            <li
              key={e.id}
              className="border border-ff-border bg-ff-card px-4 py-3 text-sm"
            >
              <p className="font-semibold text-ff-ink">
                {e.entry_date ?? "—"} ·{" "}
                {epaTitle.get(e.epa_id) ?? "Unknown EPA"} ·{" "}
                {levelLabel(e.self_level)}
              </p>
              <p className="mt-1 text-ff-muted">{e.setting ?? ""}</p>
              <p className="mt-1 text-ff-text">{e.description ?? ""}</p>
            </li>
          ))}
          {(bundle.entries ?? []).length === 0 && (
            <li className="text-sm text-ff-muted">No encounters logged yet.</li>
          )}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ff-ink">Sign-offs</h2>
        <ul className="mt-4 space-y-3">
          {(bundle.signoffs ?? []).map((s) => (
            <li
              key={s.id}
              className="border border-ff-border bg-ff-tint/40 px-4 py-3 text-sm"
            >
              <p className="font-semibold text-ff-ink">
                {epaTitle.get(s.epa_id) ?? "Unknown EPA"} · {levelLabel(s.level)}
              </p>
              <p className="mt-1 text-ff-muted">
                {s.supervisor?.display_name || s.supervisor?.email || "Supervisor"}{" "}
                ·{" "}
                {s.signed_at
                  ? new Date(s.signed_at).toLocaleString()
                  : "—"}
              </p>
              {s.note ? <p className="mt-1 text-ff-text">{s.note}</p> : null}
            </li>
          ))}
          {(bundle.signoffs ?? []).length === 0 && (
            <li className="text-sm text-ff-muted">
              No supervisor sign-offs yet.
            </li>
          )}
        </ul>
      </section>

      <p className="mt-10 text-xs text-ff-muted">
        Course: {course.title}. Entries and sign-offs are append-only.
      </p>
    </main>
  );
}
