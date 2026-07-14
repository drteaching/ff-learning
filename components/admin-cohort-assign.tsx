"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  assignLearnerToCohort,
  assignSupervisor,
  removeLearnerFromCohort,
  removeSupervisorAssignment,
} from "@/lib/learning/admin-actions";

type EnrolmentOption = {
  id: string;
  label: string;
  inCohort: boolean;
};

type SupervisorOption = {
  id: string;
  label: string;
  role: string;
};

type Assignment = {
  enrolmentId: string;
  learnerLabel: string;
  supervisors: { id: string; label: string }[];
};

type Props = {
  courseId: string;
  cohortId: string;
  enrolments: EnrolmentOption[];
  supervisors: SupervisorOption[];
  assignments: Assignment[];
};

export function CohortAssignPanel({
  courseId,
  cohortId,
  enrolments,
  supervisors,
  assignments,
}: Props) {
  const router = useRouter();
  const [enrolmentId, setEnrolmentId] = useState("");
  const [learnerForSup, setLearnerForSup] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const available = enrolments.filter((e) => !e.inCohort);
  const inCohort = enrolments.filter((e) => e.inCohort);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-md bg-ff-amber-tint px-3 py-2 text-sm text-ff-amber">
          {error}
        </p>
      )}

      <section className="border border-ff-border bg-ff-card p-5">
        <h2 className="font-display text-lg text-ff-ink">Add learner to cohort</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={enrolmentId}
            onChange={(e) => setEnrolmentId(e.target.value)}
            className="min-w-[16rem] flex-1 rounded-md border border-ff-border px-3 py-2 text-sm"
          >
            <option value="">Select enrolled learner…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !enrolmentId}
            onClick={() =>
              run(() =>
                assignLearnerToCohort({ courseId, cohortId, enrolmentId }),
              )
            }
            className="rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </section>

      <section className="border border-ff-border bg-ff-card p-5">
        <h2 className="font-display text-lg text-ff-ink">
          Assign supervisor to learner
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={learnerForSup}
            onChange={(e) => setLearnerForSup(e.target.value)}
            className="min-w-[14rem] flex-1 rounded-md border border-ff-border px-3 py-2 text-sm"
          >
            <option value="">Learner in cohort…</option>
            {inCohort.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <select
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            className="min-w-[14rem] flex-1 rounded-md border border-ff-border px-3 py-2 text-sm"
          >
            <option value="">Supervisor / admin…</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.role})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !learnerForSup || !supervisorId}
            onClick={() =>
              run(() =>
                assignSupervisor({
                  courseId,
                  cohortId,
                  enrolmentId: learnerForSup,
                  supervisorUserId: supervisorId,
                }),
              )
            }
            className="rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
          >
            Assign
          </button>
        </div>
        <p className="mt-2 text-xs text-ff-muted">
          Learners promoted to supervisor keep their assignment capability for
          sign-off.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg text-ff-ink">Cohort roster</h2>
        <ul className="mt-3 space-y-3">
          {assignments.map((a) => (
            <li
              key={a.enrolmentId}
              className="border border-ff-border bg-ff-card p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ff-ink">{a.learnerLabel}</p>
                  <p className="mt-1 text-ff-muted">
                    Supervisors:{" "}
                    {a.supervisors.length
                      ? a.supervisors.map((s) => s.label).join(", ")
                      : "none"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      removeLearnerFromCohort({
                        courseId,
                        cohortId,
                        enrolmentId: a.enrolmentId,
                      }),
                    )
                  }
                  className="text-ff-primary hover:underline"
                >
                  Remove from cohort
                </button>
              </div>
              {a.supervisors.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-ff-border pt-2">
                  {a.supervisors.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span>{s.label}</span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            removeSupervisorAssignment({
                              courseId,
                              cohortId,
                              enrolmentId: a.enrolmentId,
                              supervisorUserId: s.id,
                            }),
                          )
                        }
                        className="text-ff-amber hover:underline"
                      >
                        Unassign
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {assignments.length === 0 && (
            <li className="text-sm text-ff-muted">No learners in this cohort yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
