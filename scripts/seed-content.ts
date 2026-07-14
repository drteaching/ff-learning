/**
 * Seed modules, lessons, and quiz questions for
 * Clinical Rotation in Reproductive Medicine.
 *
 * Requires:
 *   - Schema + course seed already applied
 *   - Migration 20260714160003_quiz_questions_source_id.sql applied
 *   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
 *
 * Safe to re-run: upserts on (course_id, ordinal), (module_id, ordinal),
 * and (course_id, source_id).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const COURSE_SLUG = "clinical-rotation-reproductive-medicine";

const MODULES: {
  ordinal: number;
  title: string;
  summary: string;
  file: string;
}[] = [
  {
    ordinal: 1,
    title: "Reproductive Physiology & Endocrinology",
    summary: "Foundations of human reproduction",
    file: "module1_content.html",
  },
  {
    ordinal: 2,
    title: "Infertility Assessment & Initial Management",
    summary: "Clinical translation — physiology becomes diagnostic reasoning",
    file: "module2_content.html",
  },
  {
    ordinal: 3,
    title: "ART Fundamentals — Stimulation, IVF & the Laboratory",
    summary:
      "The clinic's core offering — and the thing an online course cannot replicate",
    file: "module3_content.html",
  },
  {
    ordinal: 4,
    title: "Ultrasound in Reproductive Medicine",
    summary:
      "Spatial reasoning and procedural literacy — seeing what the clinic sees",
    file: "module4_content.html",
  },
  {
    ordinal: 5,
    title: "Complex Cases — Endometriosis, Male Factor & Advanced ART",
    summary: "Where the algorithm breaks down and clinical judgement begins",
    file: "module5_content.html",
  },
  {
    ordinal: 6,
    title: "Ethics, Law, Communication & Professional Practice",
    summary: "The judgement that holds the science together",
    file: "module6_content.html",
  },
];

type BankQuestion = {
  id: number;
  module: number;
  question: string;
  options: string[];
  answer_index: number;
  rationale: string;
};

/** Run from the repo root (`npm run seed:content`). */
const contentDir = join(process.cwd(), "content");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/** Extract <body> inner HTML; drop scripts; keep inline SVGs. */
function extractBodyHtml(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!match) {
    throw new Error("No <body> found in module HTML");
  }
  return match[1]
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim();
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title")
    .eq("slug", COURSE_SLUG)
    .single();

  if (courseError || !course) {
    throw new Error(
      `Course not found for slug ${COURSE_SLUG}. Apply schema + seed migrations first. ${courseError?.message ?? ""}`,
    );
  }

  console.log(`Course: ${course.title} (${course.id})`);

  const moduleIdByOrdinal = new Map<number, string>();

  for (const mod of MODULES) {
    const filePath = join(contentDir, mod.file);
    const raw = readFileSync(filePath, "utf8");
    const bodyHtml = extractBodyHtml(raw);

    const { data: moduleRow, error: moduleError } = await supabase
      .from("modules")
      .upsert(
        {
          course_id: course.id,
          ordinal: mod.ordinal,
          title: mod.title,
          summary: mod.summary,
        },
        { onConflict: "course_id,ordinal" },
      )
      .select("id, ordinal, title")
      .single();

    if (moduleError || !moduleRow) {
      throw new Error(
        `Module ${mod.ordinal} upsert failed: ${moduleError?.message}`,
      );
    }

    moduleIdByOrdinal.set(mod.ordinal, moduleRow.id);

    const { error: lessonError } = await supabase.from("lessons").upsert(
      {
        module_id: moduleRow.id,
        ordinal: 1,
        title: mod.title,
        body_html: bodyHtml,
      },
      { onConflict: "module_id,ordinal" },
    );

    if (lessonError) {
      throw new Error(
        `Lesson for module ${mod.ordinal} upsert failed: ${lessonError.message}`,
      );
    }

    console.log(
      `  Module ${mod.ordinal}: ${mod.title} (${bodyHtml.length.toLocaleString()} chars body)`,
    );
  }

  const questions = JSON.parse(
    readFileSync(join(contentDir, "questions.json"), "utf8"),
  ) as BankQuestion[];

  if (questions.length !== 90) {
    console.warn(`Expected 90 questions, found ${questions.length}`);
  }

  const quizRows = questions.map((q) => {
    const moduleId = moduleIdByOrdinal.get(q.module);
    if (!moduleId) {
      throw new Error(`Question ${q.id} references unknown module ${q.module}`);
    }
    return {
      course_id: course.id,
      module_id: moduleId,
      source_id: q.id,
      stem: q.question,
      options: q.options,
      correct_index: q.answer_index,
      rationale: q.rationale,
      audience_tags: [] as string[],
    };
  });

  // Chunk to stay under PostgREST payload limits
  const chunkSize = 30;
  for (let i = 0; i < quizRows.length; i += chunkSize) {
    const chunk = quizRows.slice(i, i + chunkSize);
    const { error: quizError } = await supabase
      .from("quiz_questions")
      .upsert(chunk, { onConflict: "course_id,source_id" });

    if (quizError) {
      throw new Error(
        `quiz_questions upsert failed (offset ${i}): ${quizError.message}. ` +
          `If this mentions source_id / conflict, run migration 20260714160003_quiz_questions_source_id.sql first.`,
      );
    }
  }

  const { count: moduleCount } = await supabase
    .from("modules")
    .select("*", { count: "exact", head: true })
    .eq("course_id", course.id);

  const { count: lessonCount } = await supabase
    .from("lessons")
    .select("*, modules!inner(course_id)", { count: "exact", head: true })
    .eq("modules.course_id", course.id);

  const { count: quizCount } = await supabase
    .from("quiz_questions")
    .select("*", { count: "exact", head: true })
    .eq("course_id", course.id);

  console.log("\nDone (safe to re-run).");
  console.log(`  modules:        ${moduleCount}`);
  console.log(`  lessons:        ${lessonCount}`);
  console.log(`  quiz_questions: ${quizCount}`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
