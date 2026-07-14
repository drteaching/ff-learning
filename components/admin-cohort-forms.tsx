"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCohort } from "@/lib/learning/admin-actions";

export function CreateCohortForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCohort({
        courseId,
        name,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setStartDate("");
      setEndDate("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 border border-ff-border bg-ff-card p-5"
    >
      <h2 className="font-display text-lg text-ff-ink">Create cohort</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Intake July 2026"
          className="rounded-md border border-ff-border px-3 py-2 text-sm sm:col-span-3"
          required
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-md border border-ff-border px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-md border border-ff-border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ff-primary px-3 py-2 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create"}
        </button>
      </div>
      {error && <p className="text-sm text-ff-amber">{error}</p>}
    </form>
  );
}
