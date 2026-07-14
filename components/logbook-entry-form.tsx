"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createLogbookEntry } from "@/lib/learning/logbook-actions";
import { LEVEL_NAMES } from "@/lib/learning/logbook";

type Epa = { id: string; number: number; title: string };

type Props = {
  enrolmentId: string;
  courseSlug: string;
  epas: Epa[];
};

export function LogbookEntryForm({ enrolmentId, courseSlug, epas }: Props) {
  const router = useRouter();
  const [epaId, setEpaId] = useState(epas[0]?.id ?? "");
  const [entryDate, setEntryDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [setting, setSetting] = useState("");
  const [description, setDescription] = useState("");
  const [selfLevel, setSelfLevel] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createLogbookEntry({
        enrolmentId,
        epaId,
        entryDate,
        setting,
        description,
        selfLevel,
        courseSlug,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSetting("");
      setDescription("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 border border-ff-border bg-ff-card p-5"
    >
      <h2 className="font-display text-xl text-ff-ink">Log an encounter</h2>
      <p className="text-xs text-ff-muted">
        De-identify everything. Do not include patient names, MRNs, DOB, or other
        identifiers.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-semibold text-ff-ink" htmlFor="epa">
            EPA
          </label>
          <select
            id="epa"
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
        </div>
        <div>
          <label className="text-sm font-semibold text-ff-ink" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-ff-ink" htmlFor="level">
            Self-assessed level
          </label>
          <select
            id="level"
            value={selfLevel}
            onChange={(e) => setSelfLevel(Number(e.target.value))}
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
          <label className="text-sm font-semibold text-ff-ink" htmlFor="setting">
            Setting
          </label>
          <input
            id="setting"
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            placeholder="clinic / theatre / lab / ultrasound…"
            className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-semibold text-ff-ink" htmlFor="desc">
            Brief description
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What you did (de-identified)"
            className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 text-sm"
            required
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-ff-amber-tint px-3 py-2 text-sm text-ff-amber">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !epaId}
        className="rounded-md bg-ff-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add entry"}
      </button>
    </form>
  );
}
