import sanitizeHtml from "sanitize-html";

/**
 * Sanitise lesson HTML for trusted first-party module content.
 * Uses sanitize-html (no jsdom) so serverless/Vercel never crashes the
 * way isomorphic-dompurify/jsdom can with ".replace of undefined".
 */
export function sanitizeLessonHtml(dirty: string | null | undefined): string {
  if (typeof dirty !== "string" || dirty.length === 0) {
    return "";
  }

  try {
    return sanitizeHtml(dirty, {
      // Keep educational markup + inline SVG diagrams from seeded modules.
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "h1",
        "h2",
        "section",
        "header",
        "footer",
        "nav",
        "main",
        "article",
        "aside",
        "figure",
        "figcaption",
        "svg",
        "g",
        "path",
        "circle",
        "ellipse",
        "rect",
        "line",
        "polyline",
        "polygon",
        "text",
        "tspan",
        "defs",
        "clipPath",
        "mask",
        "use",
        "symbol",
        "marker",
        "linearGradient",
        "radialGradient",
        "stop",
        "title",
        "desc",
      ]),
      allowedAttributes: false,
      allowedSchemes: ["http", "https", "mailto", "data"],
      // Inline styles are used heavily in module HTML and SVGs.
      allowVulnerableTags: false,
      parseStyleAttributes: false,
    });
  } catch (err) {
    console.error("[sanitizeLessonHtml] failed; using script-strip fallback", err);
    return dirty
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
      .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
      .replace(/<embed\b[^>]*>/gi, "")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/javascript:/gi, "");
  }
}
