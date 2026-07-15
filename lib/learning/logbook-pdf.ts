import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { levelLabel, type EpaProgress } from "@/lib/learning/logbook";
import type { LogbookEntryRow, SignoffRow } from "@/lib/learning/logbook-data";

const ink = rgb(0.016, 0.125, 0.247); // --ff-ink
const primary = rgb(0.039, 0.29, 0.561); // --ff-primary
const muted = rgb(0.4, 0.455, 0.541);
const text = rgb(0.173, 0.208, 0.259);

type PdfInput = {
  courseTitle: string;
  learnerName: string;
  learnerEmail: string;
  trackLabel: string;
  progress: EpaProgress[];
  entries: LogbookEntryRow[];
  signoffs: SignoffRow[];
  epaTitles: Map<string, string>;
};

function wrap(
  font: PDFFont,
  textStr: string,
  size: number,
  maxWidth: number,
): string[] {
  const words = textStr.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function buildLogbookPdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const contentWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (need: number) => {
    if (y < margin + need) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawLines = (
    lines: string[],
    size: number,
    f: PDFFont,
    color = text,
    gap = 4,
  ) => {
    for (const line of lines) {
      ensureSpace(size + gap);
      page.drawText(line, { x: margin, y, size, font: f, color });
      y -= size + gap;
    }
  };

  // Header
  page.drawRectangle({
    x: 0,
    y: pageHeight - 90,
    width: pageWidth,
    height: 90,
    color: ink,
  });
  page.drawText("Clinical Education · SCOLA", {
    x: margin,
    y: pageHeight - 38,
    size: 10,
    font: fontBold,
    color: rgb(0.831, 0.627, 0.118),
  });
  page.drawText("EPA Clinical Logbook — Accreditation Record", {
    x: margin,
    y: pageHeight - 58,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(input.courseTitle, {
    x: margin,
    y: pageHeight - 76,
    size: 10,
    font,
    color: rgb(0.85, 0.9, 0.95),
  });
  y = pageHeight - 110;

  drawLines([`Learner: ${input.learnerName} (${input.learnerEmail})`], 11, fontBold, ink);
  drawLines([`Audience track: ${input.trackLabel}`], 11, font, text);
  drawLines(
    [`Generated: ${new Date().toISOString().slice(0, 19)}Z`],
    9,
    font,
    muted,
  );
  drawLines(
    [
      "No patient-identifiable information. Sign-offs are immutable append-only records.",
    ],
    9,
    font,
    muted,
  );
  y -= 8;

  // Progress
  drawLines(["Progress against targets", ""], 14, fontBold, primary);
  for (const p of input.progress ?? []) {
    if (!p) continue;
    ensureSpace(40);
    const status =
      p.status === "target_met"
        ? "TARGET MET"
        : p.status === "working_toward"
          ? "WORKING TOWARD"
          : "NOT STARTED";
    drawLines(
      [
        `EPA ${p.number ?? "—"} · ${p.title ?? "Untitled"}`,
        `  Target ${levelLabel(p.targetLevel)} · Signed ${p.signedPeak ? levelLabel(p.signedPeak) : "—"} · Self ${p.selfPeak ? levelLabel(p.selfPeak) : "—"} · ${status}`,
      ],
      10,
      font,
    );
    y -= 4;
  }

  y -= 10;
  drawLines(["Encounter log", ""], 14, fontBold, primary);
  if (!input.entries?.length) {
    drawLines(["No entries recorded."], 10, font, muted);
  }
  for (const e of input.entries ?? []) {
    if (!e) continue;
    const title = input.epaTitles.get(e.epa_id) ?? "EPA";
    const body = wrap(
      font,
      `${e.entry_date ?? "—"} · ${e.setting ?? ""} · Self ${levelLabel(e.self_level)} · ${title}: ${e.description ?? ""}`,
      10,
      contentWidth,
    );
    drawLines(body, 10, font);
    y -= 6;
  }

  y -= 10;
  drawLines(["Supervisor sign-offs (immutable)", ""], 14, fontBold, primary);
  if (!input.signoffs?.length) {
    drawLines(["No sign-offs recorded."], 10, font, muted);
  }
  for (const s of input.signoffs ?? []) {
    if (!s) continue;
    const title = input.epaTitles.get(s.epa_id) ?? "EPA";
    const name =
      s.supervisor?.display_name || s.supervisor?.email || s.supervisor_user_id;
    const note = s.note ? ` Note: ${s.note}` : "";
    const body = wrap(
      font,
      `${(s.signed_at ?? "").slice(0, 19) || "—"}Z · ${title} · ${levelLabel(s.level)} · Supervisor: ${name}.${note}`,
      10,
      contentWidth,
    );
    drawLines(body, 10, font);
    y -= 6;
  }

  // Footer on last page
  page.drawText(
    "SCOLA · Structured Clinical Online Learning & Assessment · accreditation export",
    {
      x: margin,
      y: 28,
      size: 8,
      font,
      color: muted,
    },
  );

  return doc.save();
}
