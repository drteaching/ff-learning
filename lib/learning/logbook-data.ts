import { createClient } from "@/lib/supabase/server";
import { computeEpaProgress, type EpaProgress } from "@/lib/learning/logbook";

export type LogbookEntryRow = {
  id: string;
  epa_id: string;
  entry_date: string;
  setting: string;
  description: string;
  self_level: number;
  created_at: string;
};

export type SignoffRow = {
  id: string;
  epa_id: string;
  supervisor_user_id: string;
  level: number;
  note: string | null;
  signed_at: string;
  supervisor?: { display_name: string | null; email: string } | null;
};

export type EpaDefRow = {
  id: string;
  number: number;
  title: string;
  definition: string;
  level_descriptors: unknown;
};

export async function loadLogbookBundle(enrolmentId: string, trackId: string) {
  const supabase = await createClient();

  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id, course_id, user_id, track_id, status")
    .eq("id", enrolmentId)
    .maybeSingle();

  if (!enrolment) return null;

  const [
    { data: epas },
    { data: targets },
    { data: entries },
    { data: signoffRows },
    { data: learner },
    { data: track },
  ] = await Promise.all([
    supabase
      .from("epa_definitions")
      .select("id, number, title, definition, level_descriptors")
      .eq("course_id", enrolment.course_id)
      .order("number"),
    supabase
      .from("epa_targets")
      .select("epa_id, target_level")
      .eq("track_id", trackId),
    supabase
      .from("logbook_entries")
      .select("id, epa_id, entry_date, setting, description, self_level, created_at")
      .eq("enrolment_id", enrolmentId)
      .order("entry_date", { ascending: false }),
    supabase
      .from("signoffs")
      .select("id, epa_id, supervisor_user_id, level, note, signed_at")
      .eq("enrolment_id", enrolmentId)
      .order("signed_at", { ascending: false }),
    supabase
      .from("users")
      .select("id, email, display_name")
      .eq("id", enrolment.user_id)
      .maybeSingle(),
    supabase
      .from("audience_tracks")
      .select("id, key, label")
      .eq("id", trackId)
      .maybeSingle(),
  ]);

  const supervisorIds = [
    ...new Set((signoffRows ?? []).map((s) => s.supervisor_user_id)),
  ];
  const { data: supervisors } =
    supervisorIds.length > 0
      ? await supabase
          .from("users")
          .select("id, email, display_name")
          .in("id", supervisorIds)
      : { data: [] as { id: string; email: string; display_name: string | null }[] };

  const supervisorById = new Map(
    (supervisors ?? []).map((s) => [s.id, s] as const),
  );

  const signoffs: SignoffRow[] = (signoffRows ?? []).map((s) => ({
    ...s,
    supervisor: supervisorById.get(s.supervisor_user_id) ?? null,
  }));

  const targetByEpa = new Map(
    (targets ?? []).map((t) => [t.epa_id, t.target_level] as const),
  );

  const progress: EpaProgress[] = (epas ?? []).map((epa) =>
    computeEpaProgress({
      epaId: epa.id,
      number: epa.number,
      title: epa.title,
      definition: epa.definition,
      targetLevel: targetByEpa.get(epa.id) ?? 1,
      entryLevels: (entries ?? [])
        .filter((e) => e.epa_id === epa.id)
        .map((e) => e.self_level),
      signoffLevels: signoffs
        .filter((s) => s.epa_id === epa.id)
        .map((s) => s.level),
    }),
  );

  return {
    enrolment,
    epas: (epas ?? []) as EpaDefRow[],
    entries: (entries ?? []) as LogbookEntryRow[],
    signoffs,
    progress,
    learner: learner as {
      id: string;
      email: string;
      display_name: string | null;
    } | null,
    track: track as { id: string; key: string; label: string } | null,
  };
}
