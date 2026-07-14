import Link from "next/link";
import { requireCourseAccess } from "@/lib/learning/access";
import { createClient } from "@/lib/supabase/server";
import { QuizPlayer, type QuizQuestion } from "@/components/quiz-player";

type Props = { params: Promise<{ slug: string }> };

export default async function MixedQuizPage({ params }: Props) {
  const { slug } = await params;
  const { course } = await requireCourseAccess(slug);
  const supabase = await createClient();

  const { data: modules } = await supabase
    .from("modules")
    .select("id, ordinal, title")
    .eq("course_id", course.id);

  const moduleById = new Map(
    (modules ?? []).map((m) => [m.id, m] as const),
  );

  const { data: rows } = await supabase
    .from("quiz_questions")
    .select("id, stem, options, correct_index, rationale, module_id, source_id")
    .eq("course_id", course.id)
    .order("source_id", { ascending: true });

  const all: QuizQuestion[] = (rows ?? []).map((r) => {
    const mod = r.module_id ? moduleById.get(r.module_id) : undefined;
    return {
      id: r.id,
      stem: r.stem,
      options: r.options as string[],
      correct_index: r.correct_index,
      rationale: r.rationale,
      module_ordinal: mod?.ordinal,
      module_title: mod
        ? `Module ${mod.ordinal} · ${mod.title}`
        : undefined,
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href={`/courses/${slug}`}
        className="text-sm text-ff-primary-2 hover:underline"
      >
        ← Course overview
      </Link>
      <div className="mt-4">
        <QuizPlayer title="Mixed exam" questions={all} mixedExam />
      </div>
    </main>
  );
}
