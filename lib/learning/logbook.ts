export const LEVEL_NAMES: Record<number, string> = {
  1: "Observed",
  2: "Assisted",
  3: "Supervised",
  4: "Independent",
};

/** Safe label for entrustment levels 1–4 (never throws on null/undefined). */
export function levelLabel(level: number | null | undefined): string {
  if (level == null || Number.isNaN(Number(level))) {
    return "—";
  }
  const n = Number(level);
  return `L${n} · ${LEVEL_NAMES[n] ?? "Unknown"}`;
}

/**
 * Seeded as `{ level, name }` and sometimes also `{ description }`.
 * Never assume description (or the descriptor object itself) exists.
 */
export type LevelDescriptor = {
  level?: number | null;
  name?: string | null;
  description?: string | null;
};

export function parseLevelDescriptors(raw: unknown): LevelDescriptor[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is LevelDescriptor =>
      item != null && typeof item === "object" && !Array.isArray(item),
  );
}

/** Find a descriptor by level without throwing when missing. */
export function findLevelDescriptor(
  raw: unknown,
  level: number | null | undefined,
): LevelDescriptor | undefined {
  if (level == null) return undefined;
  return parseLevelDescriptors(raw).find((d) => d?.level === level);
}

export function descriptorHeading(d: LevelDescriptor | null | undefined): string {
  if (!d) return "—";
  const name =
    (typeof d.name === "string" && d.name.trim()) ||
    (d.level != null ? LEVEL_NAMES[Number(d.level)] : undefined) ||
    "Unknown";
  if (d.level == null || Number.isNaN(Number(d.level))) {
    return name;
  }
  return `L${Number(d.level)} · ${name}`;
}

export function descriptorDescription(
  d: LevelDescriptor | null | undefined,
): string | null {
  if (!d || typeof d.description !== "string") return null;
  const trimmed = d.description.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type EpaProgress = {
  epaId: string;
  number: number;
  title: string;
  definition: string;
  targetLevel: number;
  selfPeak: number;
  signedPeak: number;
  /** Accreditation status uses supervisor-confirmed level. */
  status: "target_met" | "working_toward" | "not_started";
};

function peakOf(levels: Array<number | null | undefined>): number {
  return (levels ?? []).reduce<number>((max, n) => {
    if (n == null || Number.isNaN(Number(n))) return max;
    return Math.max(max, Number(n));
  }, 0);
}

export function computeEpaProgress(input: {
  epaId: string;
  number: number;
  title: string;
  definition?: string | null;
  targetLevel?: number | null;
  entryLevels?: Array<number | null | undefined>;
  signoffLevels?: Array<number | null | undefined>;
}): EpaProgress {
  const targetLevel =
    input.targetLevel != null && !Number.isNaN(Number(input.targetLevel))
      ? Number(input.targetLevel)
      : 1;
  const selfPeak = peakOf(input.entryLevels ?? []);
  const signedPeak = peakOf(input.signoffLevels ?? []);
  let status: EpaProgress["status"] = "not_started";
  if (signedPeak >= targetLevel) status = "target_met";
  else if (signedPeak > 0 || selfPeak > 0) status = "working_toward";
  return {
    epaId: input.epaId,
    number: input.number,
    title: input.title || "Untitled EPA",
    definition: input.definition ?? "",
    targetLevel,
    selfPeak,
    signedPeak,
    status,
  };
}
