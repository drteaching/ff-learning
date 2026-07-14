import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCourseAccess } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { QuizPlayer, type QuizQuestion } from "@/components/quiz-player";

type Props = {
  params: Promise<{ slug: string; ordinal: string }>;
};

export default async function ModuleQuizPage({ params }: Props) {
  const { slug, ordinal: ordinalRaw } = await params;
  const ordinal = Number(ordinalRaw);
  if (!Number.isInteger(ordinal) || ordinal < 1) notFound();

  const { course } = await requireCourseAccess(slug);
  const supabase = await createClient();

  const { data: mod } = await supabase
    .from("modules")
    .select("id, ordinal, title")
    .eq("course_id", course.id)
    .eq("ordinal", ordinal)
    .maybeSingle();

  if (!mod) notFound();

  const { data: rows } = await supabase
    .from("quiz_questions")
    .select("id, stem, options, correct_index, rationale, source_id")
    .eq("course_id", course.id)
    .eq("module_id", mod.id)
    .order("source_id", { ascending: true });

  const questions: QuizQuestion[] = (rows ?? []).map((r) => ({
    id: r.id,
    stem: r.stem,
    options: r.options as string[],
    correct_index: r.correct_index,
    rationale: r.rationale,
    module_ordinal: mod.ordinal,
    module_title: `Module ${mod.ordinal} · ${mod.title}`,
  }));

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href={`/courses/${slug}/modules/${ordinal}`}
        className="text-sm text-ff-primary-2 hover:underline"
      >
        ← Back to module
      </Link>
      <div className="mt-4">
        <QuizPlayer
          title={`Module ${mod.ordinal} quiz · ${mod.title}`}
          questions={questions}
        />
      </div>
    </main>
  );
}
