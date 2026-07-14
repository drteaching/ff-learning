"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteMediaRow,
  importFigureCreditsFromBundledXlsx,
  upsertMediaRow,
} from "@/lib/learning/admin-actions";

type Row = {
  id: string;
  asset_key: string;
  title: string | null;
  credit: string | null;
  licence: string | null;
  source_url: string | null;
  notes: string | null;
};

export function MediaRegisterManager({
  courseId,
  rows,
}: {
  courseId: string;
  rows: Row[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    assetKey: "",
    title: "",
    credit: "",
    licence: "",
    sourceUrl: "",
    notes: "",
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await importFigureCreditsFromBundledXlsx({
                courseId,
              });
              if (!result.ok) setError(result.error);
              else {
                setMessage(`Imported ${result.imported ?? 0} figure credit rows.`);
                router.refresh();
              }
            });
          }}
          className="rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
        >
          Import from content/figure_credits_register.xlsx
        </button>
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

      <form
        className="grid gap-3 border border-ff-border bg-ff-card p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await upsertMediaRow({ courseId, ...form });
            if (!result.ok) setError(result.error);
            else {
              setForm({
                assetKey: "",
                title: "",
                credit: "",
                licence: "",
                sourceUrl: "",
                notes: "",
              });
              router.refresh();
            }
          });
        }}
      >
        <h2 className="font-display text-lg text-ff-ink sm:col-span-2">
          Add / update row
        </h2>
        {(
          [
            ["assetKey", "Asset key (e.g. M1-F01)"],
            ["title", "Title / description"],
            ["credit", "Credit line"],
            ["licence", "Licence"],
            ["sourceUrl", "Source URL"],
            ["notes", "Notes"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm">
            <span className="font-semibold text-ff-ink">{label}</span>
            <input
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="mt-1 w-full rounded-md border border-ff-border px-3 py-2"
              required={key === "assetKey"}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60 sm:col-span-2"
        >
          Save
        </button>
      </form>

      <div className="overflow-x-auto border border-ff-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-ff-ink text-white">
            <tr>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Licence</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-ff-border align-top">
                <td className="px-3 py-2 font-mono text-xs">{r.asset_key}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-ff-ink">{r.title}</div>
                  <div className="text-xs text-ff-muted">{r.credit}</div>
                </td>
                <td className="px-3 py-2 text-ff-muted">{r.licence}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteMediaRow({ courseId, id: r.id });
                        router.refresh();
                      })
                    }
                    className="text-xs text-ff-amber hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-ff-muted">
                  No media register rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
