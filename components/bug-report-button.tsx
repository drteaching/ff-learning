"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getErrorBuffer } from "@/lib/error-buffer";

type ReportType = "bug" | "design_suggestion";
type Severity = "low" | "medium" | "high" | "blocking";

type Screenshot = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
};

type Rect = { x: number; y: number; w: number; h: number };

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocking", label: "Blocking" },
];

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_EDGE = 1600;

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

async function loadScreenshot(blob: Blob): Promise<Screenshot> {
  const img = await blobToImage(blob);
  return { blob, url: img.src, width: img.naturalWidth, height: img.naturalHeight };
}

/** Draw the source image + rectangles at natural size, return a flattened PNG. */
async function flattenAnnotations(shot: Screenshot, rects: Rect[]): Promise<Blob> {
  const img = await blobToImage(shot.blob);
  const canvas = document.createElement("canvas");
  canvas.width = shot.width;
  canvas.height = shot.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return shot.blob;
  ctx.drawImage(img, 0, 0);
  if (rects.length) {
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = Math.max(2, Math.round(shot.width / 400));
    for (const r of rects) ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  return canvasToBlob(canvas);
}

/** Downscale so the longest edge is <= MAX_EDGE and export PNG. */
async function downscalePng(blob: Blob): Promise<Blob> {
  const img = await blobToImage(blob);
  const longest = Math.max(img.width, img.height);
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  if (scale === 1) return blob;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas);
}

export function BugReportButton() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [reportType, setReportType] = useState<ReportType>("bug");
  const [doingWhat, setDoingWhat] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [expected, setExpected] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");

  const [shot, setShot] = useState<Screenshot | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [rects, setRects] = useState<Rect[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDesign = reportType === "design_suggestion";

  // Only render for signed-in users.
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const resetForm = useCallback(() => {
    setReportType("bug");
    setDoingWhat("");
    setWhatHappened("");
    setExpected("");
    setSeverity("medium");
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    setAnnotating(false);
    setRects([]);
    setError(null);
    setSuccessId(null);
  }, [shot]);

  const closeModal = useCallback(() => {
    setOpen(false);
    resetForm();
  }, [resetForm]);

  const setScreenshotFromBlob = useCallback(
    async (blob: Blob) => {
      try {
        const next = await loadScreenshot(blob);
        setShot((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return next;
        });
        setRects([]);
        setAnnotating(false);
      } catch {
        setError("That image could not be read. Try a PNG or JPEG.");
      }
    },
    [],
  );

  // Paste-from-clipboard while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void setScreenshotFromBlob(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, setScreenshotFromBlob]);

  async function captureThisPage() {
    setError(null);
    setCapturing(true);
    // Let React hide the modal/button before snapshotting the page behind them.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const { snapdom } = await import("@zumer/snapdom");
      const result = await snapdom(document.body, { fast: true, backgroundColor: "#ffffff" });
      const canvas = await result.toCanvas();
      const blob = await canvasToBlob(canvas);
      await setScreenshotFromBlob(blob);
    } catch {
      setError("Couldn't capture the page. Try attaching or pasting a screenshot instead.");
    } finally {
      setCapturing(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void setScreenshotFromBlob(file);
    e.target.value = "";
  }

  function removeScreenshot() {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    setRects([]);
    setAnnotating(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!doingWhat.trim() || !whatHappened.trim()) {
      setError("Please fill in the first two questions.");
      return;
    }
    setSubmitting(true);
    try {
      let screenshotPath: string | null = null;
      if (shot && userId) {
        const flattened = rects.length ? await flattenAnnotations(shot, rects) : shot.blob;
        const finalBlob = await downscalePng(flattened);
        if (finalBlob.size > MAX_UPLOAD_BYTES) {
          setError("That screenshot is too large even after resizing. Try a smaller area.");
          setSubmitting(false);
          return;
        }
        const supabase = createClient();
        const path = `${userId}/${crypto.randomUUID()}.png`;
        const { error: upErr } = await supabase.storage
          .from("bug-screenshots")
          .upload(path, finalBlob, { contentType: "image/png", upsert: false });
        if (upErr) {
          setError("Screenshot upload failed. You can submit without it, or try again.");
          setSubmitting(false);
          return;
        }
        screenshotPath = path;
      }

      const { consoleErrors, networkErrors } = getErrorBuffer();
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportType,
          doingWhat,
          whatHappened,
          expected,
          severity: isDesign ? "low" : severity,
          pageUrl: window.location.href,
          route: pathname,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          appVersion: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null,
          consoleErrors,
          networkErrors,
          screenshotPath,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not submit your report. Please try again.");
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { id: string };
      setSuccessId(data.id);
    } catch {
      setError("Something went wrong submitting your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!userId) return null;

  const labels = isDesign
    ? {
        title: "Share a design suggestion",
        f1: "What page or element is this about?",
        f2: "What would you change?",
        f3: "Why would it be better?",
        submit: "Submit suggestion",
      }
    : {
        title: "Report an issue",
        f1: "What were you doing?",
        f2: "What happened?",
        f3: "What did you expect to happen?",
        submit: "Send report",
      };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed bottom-4 right-4 z-40 rounded-full border border-ff-border bg-ff-card/95 px-4 py-2 text-xs font-semibold text-ff-primary shadow-sm backdrop-blur transition hover:border-ff-primary hover:text-ff-ink ${capturing ? "invisible" : ""}`}
          aria-label="Report an issue"
        >
          Report an issue
        </button>
      )}

      {open && (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-center bg-ff-ink/40 p-0 sm:items-center sm:p-4 ${capturing ? "invisible" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Report an issue"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submitting) closeModal();
          }}
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-ff-border bg-ff-card p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
            {successId ? (
              <div className="py-6 text-center">
                <p className="font-display text-lg text-ff-ink">
                  Thanks — logged as report #{successId.slice(0, 8)}
                </p>
                <p className="mt-2 text-sm text-ff-muted">
                  {isDesign
                    ? "We'll review your suggestion."
                    : "Our team can now see what happened. Thank you for the detail."}
                </p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-5 rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-ff-ink">{labels.title}</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded p-1 text-ff-muted hover:text-ff-ink"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Report type toggle */}
                <div className="inline-flex rounded-md border border-ff-border bg-ff-tint p-0.5 text-xs font-semibold">
                  {(["bug", "design_suggestion"] as ReportType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setReportType(t)}
                      className={`rounded px-3 py-1.5 transition ${
                        reportType === t
                          ? "bg-ff-card text-ff-ink shadow-sm"
                          : "text-ff-muted hover:text-ff-ink"
                      }`}
                    >
                      {t === "bug" ? "Bug" : "Design suggestion"}
                    </button>
                  ))}
                </div>

                <Field label={labels.f1} required>
                  <textarea
                    value={doingWhat}
                    onChange={(e) => setDoingWhat(e.target.value)}
                    rows={2}
                    required
                    className="ff-textarea"
                  />
                </Field>
                <Field label={labels.f2} required>
                  <textarea
                    value={whatHappened}
                    onChange={(e) => setWhatHappened(e.target.value)}
                    rows={3}
                    required
                    className="ff-textarea"
                  />
                </Field>
                <Field label={labels.f3}>
                  <textarea
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    rows={2}
                    className="ff-textarea"
                  />
                </Field>

                {!isDesign && (
                  <Field label="Severity">
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as Severity)}
                      className="ff-input"
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {/* Screenshot */}
                <div>
                  <p className="text-sm font-semibold text-ff-ink">Screenshot (optional)</p>
                  {!shot ? (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={captureThisPage}
                        disabled={capturing}
                        className="rounded-md border border-ff-border px-3 py-1.5 text-xs font-medium text-ff-ink hover:border-ff-primary disabled:opacity-60"
                      >
                        {capturing ? "Capturing…" : "Capture this page"}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-md border border-ff-border px-3 py-1.5 text-xs font-medium text-ff-ink hover:border-ff-primary"
                      >
                        Attach a file
                      </button>
                      <span className="self-center text-xs text-ff-muted">
                        …or paste an image (Ctrl/⌘V)
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={onFileChange}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="mt-1.5 space-y-2">
                      <div className="flex items-start gap-3">
                        {annotating ? (
                          <AnnotationCanvas shot={shot} rects={rects} setRects={setRects} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={shot.url}
                            alt="Screenshot preview"
                            className="max-h-40 rounded border border-ff-border"
                          />
                        )}
                        <button
                          type="button"
                          onClick={removeScreenshot}
                          className="rounded p-1 text-ff-muted hover:text-ff-ink"
                          aria-label="Remove screenshot"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setAnnotating((a) => !a)}
                          className="rounded-md border border-ff-border px-2.5 py-1 font-medium text-ff-ink hover:border-ff-primary"
                        >
                          {annotating ? "Done annotating" : "Annotate"}
                        </button>
                        {annotating && rects.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setRects((r) => r.slice(0, -1))}
                            className="rounded-md border border-ff-border px-2.5 py-1 font-medium text-ff-ink hover:border-ff-primary"
                          >
                            Undo
                          </button>
                        )}
                        {annotating && (
                          <span className="self-center text-ff-muted">
                            Click-drag to box an area
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-md border border-ff-amber bg-ff-amber-tint px-3 py-2 text-sm text-ff-amber"
                  >
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md px-4 py-2 text-sm font-medium text-ff-muted hover:text-ff-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-md bg-ff-primary px-4 py-2 text-sm font-semibold text-white hover:bg-ff-ink disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : labels.submit}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-ff-ink">
        {label}
        {required && <span className="text-ff-amber"> *</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

/** Canvas overlay for drawing red rectangles on the screenshot. */
function AnnotationCanvas({
  shot,
  rects,
  setRects,
}: {
  shot: Screenshot;
  rects: Rect[];
  setRects: React.Dispatch<React.SetStateAction<Rect[]>>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawing = useRef<{ startX: number; startY: number; cur: Rect } | null>(null);

  const displayWidth = Math.min(shot.width, 460);
  const scale = displayWidth / shot.width;
  const displayHeight = Math.round(shot.height * scale);

  const redraw = useCallback(
    (preview?: Rect) => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 2;
      const all = preview ? [...rects, preview] : rects;
      for (const r of all) ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
    },
    [rects, scale],
  );

  useEffect(() => {
    let active = true;
    blobToImage(shot.blob).then((img) => {
      if (!active) return;
      imgRef.current = img;
      redraw();
    });
    return () => {
      active = false;
    };
  }, [shot, redraw]);

  useEffect(() => {
    redraw();
  }, [rects, redraw]);

  function toImageCoords(e: React.PointerEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }

  return (
    <canvas
      ref={canvasRef}
      width={displayWidth}
      height={displayHeight}
      className="cursor-crosshair touch-none rounded border border-ff-border"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const { x, y } = toImageCoords(e);
        drawing.current = { startX: x, startY: y, cur: { x, y, w: 0, h: 0 } };
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        const { x, y } = toImageCoords(e);
        const { startX, startY } = drawing.current;
        const cur: Rect = {
          x: Math.min(startX, x),
          y: Math.min(startY, y),
          w: Math.abs(x - startX),
          h: Math.abs(y - startY),
        };
        drawing.current.cur = cur;
        redraw(cur);
      }}
      onPointerUp={() => {
        const d = drawing.current;
        drawing.current = null;
        if (d && d.cur.w > 3 && d.cur.h > 3) setRects((r) => [...r, d.cur]);
        else redraw();
      }}
    />
  );
}
