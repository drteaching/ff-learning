import { sanitizeLessonHtml } from "@/lib/learning/sanitize";

type Props = {
  html?: string | null;
  lessonId?: string | null;
};

function isEmptyBody(html: string | null | undefined): boolean {
  return typeof html !== "string" || html.trim().length === 0;
}

function ComingSoon() {
  return (
    <div className="rounded-md border border-[var(--ff-border)] bg-[var(--ff-tint)] px-5 py-10 text-center">
      <p className="font-display text-lg text-[var(--ff-ink)]">
        Content coming soon
      </p>
      <p className="mt-2 text-sm text-[var(--ff-muted)]">
        This lesson hasn&apos;t been published yet. Check back shortly.
      </p>
    </div>
  );
}

export function SafeLessonHtml({ html, lessonId }: Props) {
  if (isEmptyBody(html)) {
    console.warn(
      `[lesson] empty body_html for lesson id=${lessonId ?? "(missing lesson row)"}`,
    );
    return <ComingSoon />;
  }

  let clean = "";
  try {
    clean = sanitizeLessonHtml(html);
  } catch (err) {
    console.error(
      `[lesson] sanitiser threw for lesson id=${lessonId ?? "(unknown)"}`,
      err,
    );
    return <ComingSoon />;
  }

  if (!clean.trim()) {
    console.warn(
      `[lesson] sanitised body_html empty for lesson id=${lessonId ?? "(unknown)"}`,
    );
    return <ComingSoon />;
  }

  return (
    <div
      className="lesson-html"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
