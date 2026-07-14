"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/learning/access";

export type TrackKey = "student" | "new_doctor" | "nurse";

export type RedeemResult =
  | { ok: true }
  | { ok: false; error: string };

export async function redeemEnrolmentCode(input: {
  courseId: string;
  courseSlug: string;
  code: string;
  trackKey?: TrackKey | "";
}): Promise<RedeemResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to enrol." };
  }

  const track =
    input.trackKey === "student" ||
    input.trackKey === "new_doctor" ||
    input.trackKey === "nurse"
      ? input.trackKey
      : null;

  const { data, error } = await supabase.rpc("redeem_enrolment_code", {
    p_course_id: input.courseId,
    p_code: input.code,
    p_track_key: track,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return {
      ok: false,
      error: result?.error ?? "Could not redeem that code.",
    };
  }

  revalidatePath(`/courses/${input.courseSlug}`);
  revalidatePath(`/courses/${input.courseSlug}/enrol`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createEnrolmentCode(input: {
  courseId: string;
  code: string;
  trackId: string | null;
  maxUses: number | null;
  expiresAt: string | null;
  isActive: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Admin role required." };
  }

  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Code is required." };

  const { error } = await supabase.from("enrolment_codes").insert({
    course_id: input.courseId,
    code,
    track_id: input.trackId || null,
    max_uses: input.maxUses,
    expires_at: input.expiresAt,
    is_active: input.isActive,
    uses: 0,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That code already exists for this course." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/courses/${input.courseId}/codes`);
  return { ok: true };
}

export async function setEnrolmentCodeActive(input: {
  codeId: string;
  courseId: string;
  isActive: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Admin role required." };
  }

  const { error } = await supabase
    .from("enrolment_codes")
    .update({ is_active: input.isActive })
    .eq("id", input.codeId)
    .eq("course_id", input.courseId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/courses/${input.courseId}/codes`);
  return { ok: true };
}
