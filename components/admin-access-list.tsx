"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  approveProfessionalAccess,
  revokeProfessionalAccess,
} from "@/lib/learning/admin-actions";

type Row = {
  userId: string;
  label: string;
  profession: string;
  ahpraOrStudentId: string | null;
  verified: boolean;
  verifiedAt: string | null;
};

export function AccessApprovalList({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.userId}
          className="flex flex-col gap-3 border border-ff-border bg-ff-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="text-sm">
            <p className="font-semibold text-ff-ink">{r.label}</p>
            <p className="text-ff-muted">
              {r.profession} · ID: {r.ahpraOrStudentId || "—"}
            </p>
            <p className="text-xs text-ff-muted">
              {r.verified
                ? `Verified ${r.verifiedAt ? new Date(r.verifiedAt).toLocaleString() : ""}`
                : "Pending approval"}
            </p>
          </div>
          <div className="flex gap-2">
            {!r.verified ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await approveProfessionalAccess({ userId: r.userId });
                    router.refresh();
                  })
                }
                className="rounded-md bg-ff-primary px-3 py-2 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
              >
                Approve
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await revokeProfessionalAccess({ userId: r.userId });
                    router.refresh();
                  })
                }
                className="rounded-md border border-ff-border px-3 py-2 text-sm text-ff-primary hover:bg-ff-tint disabled:opacity-60"
              >
                Revoke
              </button>
            )}
          </div>
        </li>
      ))}
      {rows.length === 0 && (
        <li className="text-sm text-ff-muted">No professional-access requests yet.</li>
      )}
    </ul>
  );
}
