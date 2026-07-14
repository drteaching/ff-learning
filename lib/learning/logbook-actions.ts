"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createLogbookEntry(input: {
  enrolmentId: string;
  epaId: string;
  entryDate: string;
  setting: string;
  description: string;
  selfLevel: number;
  courseSlug: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  if (
    !input.entryDate ||
    !input.setting.trim() ||
    !input.description.trim()
  ) {
    return { ok: false, error: "Date, setting, and description are required." };
  }

  if (input.selfLevel < 1 || input.selfLevel > 4) {
    return { ok: false, error: "Self-assessed level must be 1–4." };
  }

  // Never store patient-identifiable data — soft check for common identifiers.
  const blob = `${input.setting} ${input.description}`.toLowerCase();
  if (
    /\b(mrn|ur number|date of birth|dob|medicare)\b/i.test(blob) ||
    /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/.test(blob)
  ) {
    return {
      ok: false,
      error:
        "Remove patient identifiers (names, MRN, DOB, Medicare). Use de-identified descriptions only.",
    };
  }

  const { error } = await supabase.from("logbook_entries").insert({
    enrolment_id: input.enrolmentId,
    epa_id: input.epaId,
    entry_date: input.entryDate,
    setting: input.setting.trim(),
    description: input.description.trim(),
    self_level: input.selfLevel,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/courses/${input.courseSlug}/logbook`);
  revalidatePath(`/courses/${input.courseSlug}/supervise`);
  return { ok: true };
}

export async function recordSignoff(input: {
  enrolmentId: string;
  epaId: string;
  level: number;
  note: string;
  courseSlug: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("record_signoff", {
    p_enrolment_id: input.enrolmentId,
    p_epa_id: input.epaId,
    p_level: input.level,
    p_note: input.note || null,
  });

  if (error) return { ok: false, error: error.message };

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? "Could not record sign-off." };
  }

  revalidatePath(`/courses/${input.courseSlug}/logbook`);
  revalidatePath(`/courses/${input.courseSlug}/supervise`);
  revalidatePath(
    `/courses/${input.courseSlug}/supervise/${input.enrolmentId}`,
  );
  return { ok: true };
}
