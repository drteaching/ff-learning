"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  redeemEnrolmentCode,
  type TrackKey,
} from "@/lib/learning/enrolment-actions";

const TRACKS: { key: TrackKey; label: string }[] = [
  { key: "student", label: "Medical student" },
  { key: "new_doctor", label: "New-start doctor" },
  { key: "nurse", label: "Nurse" },
];

type Props = {
  courseId: string;
  courseSlug: string;
};

export function EnrolCodeForm({ courseId, courseSlug }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [trackKey, setTrackKey] = useState<TrackKey | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await redeemEnrolmentCode({
        courseId,
        courseSlug,
        code,
        trackKey,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/courses/${courseSlug}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label
          htmlFor="enrol-code"
          className="block text-sm font-semibold text-ff-ink"
        >
          Enrolment code
        </label>
        <input
          id="enrol-code"
          name="code"
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. ROTATION-2026"
          className="mt-1.5 w-full rounded-md border border-ff-border bg-ff-card px-3 py-2.5 font-mono text-sm uppercase tracking-wide text-ff-ink outline-none focus:border-ff-primary focus:ring-2 focus:ring-ff-primary/20"
          required
        />
      </div>

      <div>
        <label
          htmlFor="enrol-track"
          className="block text-sm font-semibold text-ff-ink"
        >
          Audience track
        </label>
        <p className="mt-0.5 text-xs text-ff-muted">
          Required if your code does not pre-assign a track; ignored when the
          code already has one.
        </p>
        <select
          id="enrol-track"
          value={trackKey}
          onChange={(e) => setTrackKey(e.target.value as TrackKey | "")}
          className="mt-1.5 w-full rounded-md border border-ff-border bg-ff-card px-3 py-2.5 text-sm text-ff-ink outline-none focus:border-ff-primary focus:ring-2 focus:ring-ff-primary/20"
        >
          <option value="">Select if needed…</option>
          {TRACKS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-ff-amber bg-ff-amber-tint px-3 py-2 text-sm text-ff-amber"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-ff-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
      >
        {pending ? "Enrolling…" : "Enrol with code"}
      </button>
    </form>
  );
}
