import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
};

export type EnrolmentRow = {
  id: string;
  course_id: string;
  status: string;
  track_id: string | null;
};

export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  role: "learner" | "supervisor" | "admin";
};

export async function getAuthUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getUserProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, display_name, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

export async function requireAuth(returnTo?: string) {
  const user = await getAuthUser();
  if (!user) {
    const params = returnTo
      ? `?next=${encodeURIComponent(returnTo)}`
      : "";
    redirect(`/auth/login${params}`);
  }
  return user;
}

export async function requireAdmin(returnTo = "/admin") {
  const user = await requireAuth(returnTo);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }
  return { user, profile };
}

export async function getCourseBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title, description, published")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) throw error;
  return data as CourseRow | null;
}

export async function getActiveEnrolment(courseId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrolments")
    .select("id, course_id, status, track_id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data as EnrolmentRow | null;
}

/** Auth + active enrolment required for course content. */
export async function requireCourseAccess(slug: string) {
  const returnTo = `/courses/${slug}`;
  const user = await requireAuth(returnTo);
  const course = await getCourseBySlug(slug);

  if (!course) {
    redirect("/");
  }

  const enrolment = await getActiveEnrolment(course.id, user.id);
  if (!enrolment) {
    redirect(`/courses/${slug}/enrol`);
  }

  return { user, course, enrolment };
}
