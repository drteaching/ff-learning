import { sanitizeLessonHtml } from "@/lib/learning/sanitize";

export function SafeLessonHtml({ html }: { html: string }) {
  const clean = sanitizeLessonHtml(html);
  return (
    <div
      className="lesson-html"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
