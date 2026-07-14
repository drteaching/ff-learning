export const LEVEL_NAMES: Record<number, string> = {
  1: "Observed",
  2: "Assisted",
  3: "Supervised",
  4: "Independent",
};

export function levelLabel(level: number): string {
  return `L${level} · ${LEVEL_NAMES[level] ?? "Unknown"}`;
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

export function computeEpaProgress(input: {
  epaId: string;
  number: number;
  title: string;
  definition: string;
  targetLevel: number;
  entryLevels: number[];
  signoffLevels: number[];
}): EpaProgress {
  const selfPeak = input.entryLevels.reduce((m, n) => Math.max(m, n), 0);
  const signedPeak = input.signoffLevels.reduce((m, n) => Math.max(m, n), 0);
  let status: EpaProgress["status"] = "not_started";
  if (signedPeak >= input.targetLevel) status = "target_met";
  else if (signedPeak > 0 || selfPeak > 0) status = "working_toward";
  return {
    epaId: input.epaId,
    number: input.number,
    title: input.title,
    definition: input.definition,
    targetLevel: input.targetLevel,
    selfPeak,
    signedPeak,
    status,
  };
}
