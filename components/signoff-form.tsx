"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordSignoff } from "@/lib/learning/logbook-actions";
import { LEVEL_NAMES, levelLabel } from "@/lib/learning/logbook";
import type { SignoffRow } from "@/lib/learning/logbook-data";

type Epa = { id: string; number: number; title: string };

type Props = {
  enrolmentId: string;
  courseSlug: string;
  epas: Epa[];
  existingSignoffs: SignoffRow[];
};

export function SignoffForm({
  enrolmentId,
  courseSlug,
  epas,
  existingSignoffs,
}: Props) {
  const router = useRouter();
  const [epaId, setEpaId] = useState(epas[0]?.id ?? "");
  const [level, setLevel] = useState(2);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const priorForEpa = existingSignoffs.filter((s) => s.epa_id === epaId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await recordSignoff({
        enrolmentId,
        epaId,
        level,
        note,
        courseSlug,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        "Sign-off recorded (immutable). A further sign-off creates a new correction row.",
      );
      setNote("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 border border-ff-border bg-ff-card p-5"
    >
      <h2 className="font-display text-xl text-ff-ink">Record sign-off</h2>
      <p className="text-xs text-ff-muted">
        Sign-offs are append-only. Corrections are new rows with a new server
        timestamp — never edits.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-semibold text-ff-ink" htmlFor="so-epa">
            EPA
          </label>
          <select
            id="so-epa"
            value={epaId}
            onChange={(e) => setEpaId(e.target.value)}
            className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 text-sm"
            required
          >
            {epas.map((e) => (
              <option key={e.id} value={e.id}>
                EPA {e.number} · {e.title}
              </option>
            ))}
          </select>
          {priorForEpa.length > 0 && (
            <p className="mt-1 text-xs text-ff-muted">
              Prior sign-offs for this EPA:{" "}
              {priorForEpa
                .map((s) => `${levelLabel(s.level)} (${s.signed_at.slice(0, 10)})`)
                .join("; ")}
            </p>
          )}
        </div>
        <div>
          <label className="text-sm font-semibold text-ff-ink" htmlFor="so-level">
            Confirmed level
          </label>
          <select
            id="so-level"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} · {LEVEL_NAMES[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-semibold text-ff-ink" htmlFor="so-note">
            Note (optional)
          </label>
          <textarea
            id="so-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 text-sm"
            placeholder="Brief feedback (de-identified)"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-ff-amber-tint px-3 py-2 text-sm text-ff-amber">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md bg-ff-green-tint px-3 py-2 text-sm text-ff-green">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !epaId}
        className="rounded-md bg-ff-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
      >
        {pending ? "Recording…" : "Record immutable sign-off"}
      </button>
    </form>
  );
}
