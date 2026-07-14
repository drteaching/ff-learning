import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCourseAccess } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { SafeLessonHtml } from "@/components/safe-lesson-html";

type Props = {
  params: Promise<{ slug: string; ordinal: string }>;
};

export default async function ModuleReaderPage({ params }: Props) {
  const { slug, ordinal: ordinalRaw } = await params;
  const ordinal = Number(ordinalRaw);
  if (!Number.isInteger(ordinal) || ordinal < 1) notFound();

  const { course } = await requireCourseAccess(slug);
  const supabase = await createClient();

  const { data: mod } = await supabase
    .from("modules")
    .select("id, ordinal, title, summary")
    .eq("course_id", course.id)
    .eq("ordinal", ordinal)
    .maybeSingle();

  if (!mod) notFound();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, body_html, ordinal")
    .eq("module_id", mod.id)
    .order("ordinal")
    .limit(1)
    .maybeSingle();

  const { data: siblings } = await supabase
    .from("modules")
    .select("ordinal")
    .eq("course_id", course.id)
    .order("ordinal");

  const ordinals = (siblings ?? []).map((s) => s.ordinal);
  const prev = ordinals.filter((o) => o < ordinal).at(-1);
  const next = ordinals.find((o) => o > ordinal);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/courses/${slug}`} className="text-ff-primary-2 hover:underline">
          ← {course.title}
        </Link>
        <span className="text-ff-border">|</span>
        <Link
          href={`/courses/${slug}/modules/${ordinal}/quiz`}
          className="font-medium text-ff-primary hover:underline"
        >
          Module quiz
        </Link>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Module {mod.ordinal} of {ordinals.length || 6}
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink sm:text-4xl">
        {mod.title}
      </h1>
      {mod.summary && (
        <p className="mt-2 text-ff-muted">{mod.summary}</p>
      )}

      <article className="mt-8 border-t border-ff-border pt-8">
        {lesson?.body_html ? (
          <SafeLessonHtml html={lesson.body_html} />
        ) : (
          <p className="text-sm text-ff-muted">
            No lesson content yet. Run the content seed script.
          </p>
        )}
      </article>

      <nav className="mt-12 flex items-center justify-between border-t border-ff-border pt-6 text-sm">
        {prev ? (
          <Link
            href={`/courses/${slug}/modules/${prev}`}
            className="font-medium text-ff-primary hover:underline"
          >
            ← Module {prev}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/courses/${slug}/modules/${next}`}
            className="font-medium text-ff-primary hover:underline"
          >
            Module {next} →
          </Link>
        ) : (
          <Link
            href={`/courses/${slug}/quiz`}
            className="font-medium text-ff-primary hover:underline"
          >
            Mixed exam →
          </Link>
        )}
      </nav>
    </main>
  );
}
