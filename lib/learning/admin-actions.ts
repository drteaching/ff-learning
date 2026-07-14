"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/learning/access";

type Result = { ok: true } | { ok: false; error: string };

async function requireAdminActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." as const, supabase, user: null };
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return { error: "Admin role required." as const, supabase, user: null };
  }
  return { error: null, supabase, user, profile };
}

export async function createCohort(input: {
  courseId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
}): Promise<Result> {
  const ctx = await requireAdminActor();
  if (ctx.error) return { ok: false, error: ctx.error };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Cohort name is required." };

  const { error } = await ctx.supabase.from("cohorts").insert({
    course_id: input.courseId,
    name,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/courses/${input.courseId}/cohorts`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function assignLearnerToCohort(input: {
  courseId: string;
  cohortId: string;
  enrolmentId: string;
}): Promise<Result> {
  const ctx = await requireAdminActor();
  if (ctx.error) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("enrolments")
    .update({ cohort_id: input.cohortId })
    .eq("id", input.enrolmentId)
    .eq("course_id", input.courseId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/courses/${input.courseId}/cohorts/${input.cohortId}`);
  return { ok: true };
}

export async function removeLearnerFromCohort(input: {
  courseId: string;
  cohortId: string;
  enrolmentId: string;
}): Promise<Result> {
  const ctx = await requireAdminActor();
  if (ctx.error) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("enrolments")
    .update({ cohort_id: null })
    .eq("id", input.enrolmentId)
    .eq("cohort_id", input.cohortId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/courses/${input.courseId}/cohorts/${input.cohortId}`);
  return { ok: true };
}

export async function assignSupervisor(input: {
  courseId: string;
  cohortId: string;
  enrolmentId: string;
  supervisorUserId: string;
}): Promise<Result> {
  const ctx = await requireAdminActor();
  if (ctx.error) return { ok: false, error: ctx.error };

  const { data: supervisor } = await ctx.supabase
    .from("users")
    .select("id, role")
    .eq("id", input.supervisorUserId)
    .maybeSingle();

  if (!supervisor) return { ok: false, error: "Supervisor user not found." };

  if (supervisor.role === "learner") {
    const { error: roleErr } = await ctx.supabase
      .from("users")
      .update({ role: "supervisor" })
      .eq("id", input.supervisorUserId);
    if (roleErr) return { ok: false, error: roleErr.message };
  }

  const { error } = await ctx.supabase.from("supervisor_assignments").upsert(
    {
      supervisor_user_id: input.supervisorUserId,
      learner_enrolment_id: input.enrolmentId,
      cohort_id: input.cohortId,
    },
    { onConflict: "supervisor_user_id,learner_enrolment_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/courses/${input.courseId}/cohorts/${input.cohortId}`);
  return { ok: true };
}

export async function removeSupervisorAssignment(input: {
  courseId: string;
  cohortId: string;
  enrolmentId: string;
  supervisorUserId: string;
}): Promise<Result> {
  const ctx = await requireAdminActor();
  if (ctx.error) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("supervisor_assignments")
    .delete()
    .eq("supervisor_user_id", input.supervisorUserId)
    .eq("learner_enrolment_id", input.enrolmentId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/courses/${input.courseId}/cohorts/${input.cohortId}`);
  return { ok: true };
}

export async function approveProfessionalAccess(input: {
  userId: string;
}): Promise<Result> {
  const ctx = await requireAdminActor();
  if (ctx.error || !ctx.user) return { ok: false, error: ctx.error ?? "Error" };

  const { error } = await ctx.supabase
    .from("professional_profiles")
    .update({
      verified: true,
      verified_by: ctx.user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/access");
  return { ok: true };
}

export async function revokeProfessionalAccess(input: {
  userId: string;
}): Promise<Result> {
  const ctx = await requireAdminActor();
  if (ctx.error) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("professional_profiles")
    .update({
      verified: false,
      verified_by: null,
      verified_at: null,
    })
    .eq("user_id", input.userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/access");
  return { ok: true };
}

export async function requestProfessionalAccess(input: {
  profession: "student" | "doctor" | "nurse";
  ahpraOrStudentId: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const id = input.ahpraOrStudentId.trim();
  if (!id) {
    return { ok: false, error: "AHPRA or student ID is required." };
  }

  const { error } = await supabase.from("professional_profiles").upsert(
    {
      user_id: user.id,
      profession: input.profession,
      ahpra_or_student_id: id,
      verified: false,
      verified_by: null,
      verified_at: null,
    },
    { onConflict: "user_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/admin/access");
  return { ok: true };
}

export async function upsertMediaRow(input: {
  courseId: string;
  assetKey: string;
  title: string;
  credit: string;
  licence: string;
  sourceUrl: string;
  notes: string;
}): Promise<Result> {
  const ctx = await requireAdminActor();
  if (ctx.error) return { ok: false, error: ctx.error };

  const key = input.assetKey.trim();
  if (!key) return { ok: false, error: "Asset key is required." };

  const { error } = await ctx.supabase.from("media_register").upsert(
    {
      course_id: input.courseId,
      asset_key: key,
      title: input.title.trim() || null,
      credit: input.credit.trim() || null,
      licence: input.licence.trim() || null,
      source_url: input.sourceUrl.trim() || null,
      notes: input.notes.trim() || null,
    },
    { onConflict: "course_id,asset_key" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/courses/${input.courseId}/media`);
  return { ok: true };
}

export async function deleteMediaRow(input: {
  courseId: string;
  id: string;
}): Promise<Result> {
  const ctx = await requireAdminActor();
  if (ctx.error) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("media_register")
    .delete()
    .eq("id", input.id)
    .eq("course_id", input.courseId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/courses/${input.courseId}/media`);
  return { ok: true };
}

export async function importFigureCreditsFromBundledXlsx(input: {
  courseId: string;
}): Promise<Result & { imported?: number }> {
  const ctx = await requireAdminActor();
  if (ctx.error) return { ok: false, error: ctx.error };

  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const XLSX = await import("xlsx");

  const path = join(process.cwd(), "content", "figure_credits_register.xlsx");
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    return {
      ok: false,
      error: "content/figure_credits_register.xlsx not found.",
    };
  }

  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets["Figure register"] ?? wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });

  const header = (raw[0] ?? []).map((h) => String(h));
  const idx = (name: string) =>
    header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const iId = idx("Image ID");
  const iMod = idx("Module");
  const iFig = idx("Figure / section");
  const iDesc = idx("Description (what it shows)");
  const iCredit = idx("Attribution / credit line");
  const iLicence = idx("Licence");
  const iUrl = idx("Source URL (licence page)");
  const iNotes = idx("Notes / status");

  if (iId < 0) {
    return { ok: false, error: "Could not find Image ID column." };
  }

  const rows = raw.slice(1).filter((r) => {
    const id = String(r[iId] ?? "").trim();
    return id && id.toUpperCase() !== "EXAMPLE";
  });

  const payload = rows.map((r) => ({
    course_id: input.courseId,
    asset_key: String(r[iId]).trim(),
    title: String(r[iDesc] ?? "").trim() || null,
    credit: String(r[iCredit] ?? "").trim() || null,
    licence: String(r[iLicence] ?? "").trim() || null,
    source_url: String(r[iUrl] ?? "").trim() || null,
    notes: [
      r[iMod] ? `Module: ${r[iMod]}` : "",
      r[iFig] ? `Figure: ${r[iFig]}` : "",
      r[iNotes] ? String(r[iNotes]) : "",
    ]
      .filter(Boolean)
      .join(" · ") || null,
  }));

  if (payload.length === 0) {
    return { ok: false, error: "No figure rows to import." };
  }

  const { error } = await ctx.supabase
    .from("media_register")
    .upsert(payload, { onConflict: "course_id,asset_key" });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/courses/${input.courseId}/media`);
  return { ok: true, imported: payload.length };
}
