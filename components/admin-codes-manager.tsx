"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createEnrolmentCode,
  setEnrolmentCodeActive,
} from "@/lib/learning/enrolment-actions";

type Track = { id: string; key: string; label: string };

type CodeRow = {
  id: string;
  code: string;
  track_id: string | null;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  is_active: boolean;
};

type Props = {
  courseId: string;
  tracks: Track[];
  codes: CodeRow[];
};

export function AdminCodesManager({ courseId, tracks, codes }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [trackId, setTrackId] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createEnrolmentCode({
        courseId,
        code,
        trackId: trackId || null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt
          ? new Date(expiresAt).toISOString()
          : null,
        isActive: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Created code ${code.trim().toUpperCase()}.`);
      setCode("");
      setTrackId("");
      setMaxUses("");
      setExpiresAt("");
      router.refresh();
    });
  }

  function toggleActive(row: CodeRow) {
    setError(null);
    startTransition(async () => {
      const result = await setEnrolmentCodeActive({
        codeId: row.id,
        courseId,
        isActive: !row.is_active,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-10">
      <form
        onSubmit={onCreate}
        className="space-y-4 border border-ff-border bg-ff-card p-5"
      >
        <h2 className="font-display text-xl text-ff-ink">Create enrolment code</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-ff-ink" htmlFor="code">
              Code
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ROTATION-2026"
              className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 font-mono text-sm uppercase"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-ff-ink" htmlFor="track">
              Pre-assign track (optional)
            </label>
            <select
              id="track"
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 text-sm"
            >
              <option value="">Learner chooses</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-ff-ink" htmlFor="max">
              Max uses (optional)
            </label>
            <input
              id="max"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-ff-ink" htmlFor="exp">
              Expires at (optional)
            </label>
            <input
              id="exp"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full rounded-md border border-ff-border px-3 py-2 text-sm"
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
          disabled={pending}
          className="rounded-md bg-ff-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create code"}
        </button>
      </form>

      <section>
        <h2 className="font-display text-xl text-ff-ink">Existing codes</h2>
        <div className="mt-4 overflow-x-auto border border-ff-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-ff-ink text-white">
              <tr>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Track</th>
                <th className="px-3 py-2 font-semibold">Uses</th>
                <th className="px-3 py-2 font-semibold">Expires</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {codes.map((row) => {
                const track = tracks.find((t) => t.id === row.track_id);
                return (
                  <tr key={row.id} className="border-t border-ff-border">
                    <td className="px-3 py-2 font-mono text-xs uppercase">
                      {row.code}
                    </td>
                    <td className="px-3 py-2 text-ff-muted">
                      {track?.label ?? "Learner chooses"}
                    </td>
                    <td className="px-3 py-2">
                      {row.uses}
                      {row.max_uses != null ? ` / ${row.max_uses}` : ""}
                    </td>
                    <td className="px-3 py-2 text-ff-muted">
                      {row.expires_at
                        ? new Date(row.expires_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.is_active ? (
                        <span className="text-ff-green">Active</span>
                      ) : (
                        <span className="text-ff-muted">Inactive</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => toggleActive(row)}
                        className="text-sm font-medium text-ff-primary hover:underline"
                      >
                        {row.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {codes.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-ff-muted"
                  >
                    No codes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
