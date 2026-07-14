"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestProfessionalAccess } from "@/lib/learning/admin-actions";

type Props = {
  existing?: {
    profession: string;
    ahpra_or_student_id: string | null;
    verified: boolean;
  } | null;
};

export function RequestAccessForm({ existing }: Props) {
  const router = useRouter();
  const [profession, setProfession] = useState<"student" | "doctor" | "nurse">(
    (existing?.profession as "student" | "doctor" | "nurse") || "student",
  );
  const [id, setId] = useState(existing?.ahpra_or_student_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (existing?.verified) {
    return (
      <p className="rounded-md bg-ff-green-tint px-3 py-2 text-sm text-ff-green">
        Professional access verified ({existing.profession}).
      </p>
    );
  }

  return (
    <form
      className="space-y-3 border border-ff-border bg-ff-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await requestProfessionalAccess({
            profession,
            ahpraOrStudentId: id,
          });
          if (!result.ok) setError(result.error);
          else {
            setMessage("Request submitted — an administrator will review it.");
            router.refresh();
          }
        });
      }}
    >
      <h3 className="font-display text-lg text-ff-ink">
        {existing ? "Update professional access request" : "Request professional access"}
      </h3>
      <p className="text-xs text-ff-muted">
        For clinical course verification (AHPRA registration or student enrolment
        ID). Required before some intakes.
      </p>
      <select
        value={profession}
        onChange={(e) =>
          setProfession(e.target.value as "student" | "doctor" | "nurse")
        }
        className="w-full rounded-md border border-ff-border px-3 py-2 text-sm"
      >
        <option value="student">Medical student</option>
        <option value="doctor">Doctor</option>
        <option value="nurse">Nurse</option>
      </select>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="AHPRA / student ID"
        className="w-full rounded-md border border-ff-border px-3 py-2 text-sm"
        required
      />
      {error && <p className="text-sm text-ff-amber">{error}</p>}
      {message && <p className="text-sm text-ff-green">{message}</p>}
      {existing && !existing.verified && (
        <p className="text-xs text-ff-amber">Status: pending approval</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
