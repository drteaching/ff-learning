"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type QuizQuestion = {
  id: string;
  stem: string;
  options: string[];
  correct_index: number;
  rationale: string | null;
  module_ordinal?: number;
  module_title?: string;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mixed exam: 5 from each module ordinal present, then shuffle. */
export function pickMixedQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const byModule = new Map<number, QuizQuestion[]>();
  for (const q of questions) {
    const m = q.module_ordinal ?? 0;
    if (!byModule.has(m)) byModule.set(m, []);
    byModule.get(m)!.push(q);
  }
  const picked: QuizQuestion[] = [];
  for (const [, list] of [...byModule.entries()].sort((a, b) => a[0] - b[0])) {
    picked.push(...shuffle(list).slice(0, 5));
  }
  return shuffle(picked);
}

type Props = {
  title: string;
  questions: QuizQuestion[];
  /** When true, start with a 5-per-module mix and allow reshuffling from the full bank. */
  mixedExam?: boolean;
};

export function QuizPlayer({ title, questions: bank, mixedExam }: Props) {
  const [questions, setQuestions] = useState(() =>
    mixedExam ? pickMixedQuestions(bank) : bank,
  );
  const [answers, setAnswers] = useState<Record<string, number | undefined>>(
    {},
  );
  const [checked, setChecked] = useState(false);

  const score = useMemo(() => {
    if (!checked) return null;
    let correct = 0;
    const perMod: Record<number, { c: number; t: number }> = {};
    for (const q of questions) {
      const m = q.module_ordinal ?? 0;
      perMod[m] ??= { c: 0, t: 0 };
      perMod[m].t++;
      if (answers[q.id] === q.correct_index) {
        correct++;
        perMod[m].c++;
      }
    }
    return { correct, total: questions.length, perMod };
  }, [answers, checked, questions]);

  function checkAll() {
    setChecked(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setAnswers({});
    setChecked(false);
  }

  function reshuffle() {
    if (!mixedExam) return;
    setQuestions(pickMixedQuestions(bank));
    setAnswers({});
    setChecked(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ff-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ff-primary-2">
            Quiz
          </p>
          <h1 className="font-display text-3xl text-ff-ink">{title}</h1>
          <p className="mt-1 text-sm text-ff-muted">
            {questions.length} single-best-answer questions · check for score and
            rationales
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mixedExam && (
            <button
              type="button"
              onClick={reshuffle}
              className="rounded-md border border-ff-border bg-ff-card px-3 py-2 text-sm font-medium text-ff-primary hover:bg-ff-tint"
            >
              New mix
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-ff-border bg-ff-card px-3 py-2 text-sm font-medium text-ff-primary hover:bg-ff-tint"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={checkAll}
            className="rounded-md bg-ff-primary px-3 py-2 text-sm font-semibold text-white hover:bg-ff-ink"
          >
            Check answers
          </button>
        </div>
      </div>

      {score && (
        <div className="sticky top-0 z-10 rounded-lg border border-ff-green bg-ff-green-tint px-4 py-3 text-ff-green shadow-sm">
          <p className="text-xl font-bold">
            {score.correct} / {score.total} correct (
            {Math.round((100 * score.correct) / score.total)}%)
          </p>
          <p className="mt-1 text-sm font-normal text-ff-text">
            {Object.keys(score.perMod)
              .sort()
              .map(
                (m) =>
                  `M${m}: ${score.perMod[+m].c}/${score.perMod[+m].t}`,
              )
              .join(" · ")}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {questions.map((q, n) => {
          const picked = answers[q.id];
          const show = checked;
          return (
            <div
              key={q.id}
              className={cn(
                "rounded-lg border border-ff-border bg-ff-card p-5",
                show &&
                  picked === q.correct_index &&
                  "border-ff-green ring-1 ring-ff-green/30",
                show &&
                  picked !== undefined &&
                  picked !== q.correct_index &&
                  "border-ff-amber ring-1 ring-ff-amber/30",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-ff-primary-2">
                Question {n + 1}
                {q.module_title
                  ? ` · ${q.module_title.split("—")[0].trim()}`
                  : q.module_ordinal
                    ? ` · Module ${q.module_ordinal}`
                    : ""}
              </p>
              <p className="mt-2 font-medium text-ff-ink">
                <span className="mr-1.5 text-ff-primary">Q{n + 1}.</span>
                {q.stem}
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = picked === oi;
                  const isCorrect = oi === q.correct_index;
                  return (
                    <label
                      key={oi}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border border-ff-border px-3 py-2.5 text-sm transition-colors",
                        !show && selected && "border-ff-primary bg-ff-tint",
                        !show && !selected && "hover:bg-ff-surface",
                        show && isCorrect && "border-ff-green bg-ff-green-tint",
                        show &&
                          selected &&
                          !isCorrect &&
                          "border-ff-amber bg-ff-amber-tint",
                      )}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name={q.id}
                        value={oi}
                        checked={selected}
                        disabled={checked}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: oi }))
                        }
                      />
                      <span>
                        <span className="mr-1.5 font-semibold text-ff-primary">
                          {LETTERS[oi]}.
                        </span>
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
              {show && q.rationale && (
                <div className="mt-3 rounded-r-md border-l-[3px] border-ff-primary bg-ff-tint px-3.5 py-2.5 text-sm">
                  <strong className="text-ff-primary">
                    Answer: {LETTERS[q.correct_index]}.
                  </strong>{" "}
                  {q.rationale}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-ff-border bg-ff-card px-3 py-2 text-sm font-medium text-ff-primary hover:bg-ff-tint"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={checkAll}
          className="rounded-md bg-ff-primary px-3 py-2 text-sm font-semibold text-white hover:bg-ff-ink"
        >
          Check answers
        </button>
      </div>
    </div>
  );
}
