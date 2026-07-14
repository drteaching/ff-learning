import Link from "next/link";
import { requireAuth, getCourseBySlug, getActiveEnrolment } from "@/lib/learning/access";
import { redirect } from "next/navigation";
import { EnrolCodeForm } from "@/components/enrol-code-form";

type Props = { params: Promise<{ slug: string }> };

export default async function EnrolPage({ params }: Props) {
  const { slug } = await params;
  const user = await requireAuth(`/courses/${slug}/enrol`);
  const course = await getCourseBySlug(slug);

  if (!course) redirect("/");

  const enrolment = await getActiveEnrolment(course.id, user.id);
  if (enrolment) redirect(`/courses/${slug}`);

  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ff-accent">
        Enrolment required
      </p>
      <h1 className="mt-2 font-display text-3xl text-ff-ink">{course.title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-ff-text">
        Enter the enrolment code from your coordinator. This is the access gate
        for the rotation (payments come later).
      </p>
      <EnrolCodeForm courseId={course.id} courseSlug={course.slug} />
      <div className="mt-8">
        <Link
          href="/"
          className="text-sm font-medium text-ff-primary-2 hover:underline"
        >
          ← Back to catalogue
        </Link>
      </div>
    </main>
  );
}
