import DOMPurify from "isomorphic-dompurify";

/** Sanitise lesson HTML while keeping inline SVGs and presentation attributes. */
export function sanitizeLessonHtml(dirty: string | null | undefined): string {
  if (typeof dirty !== "string" || dirty.length === 0) {
    return "";
  }

  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_ATTR: [
      "target",
      "rel",
      "class",
      "id",
      "style",
      "viewBox",
      "xmlns",
      "xmlns:xlink",
      "fill",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-dasharray",
      "d",
      "cx",
      "cy",
      "r",
      "rx",
      "ry",
      "x",
      "y",
      "x1",
      "y1",
      "x2",
      "y2",
      "width",
      "height",
      "transform",
      "opacity",
      "gradientUnits",
      "gradientTransform",
      "offset",
      "stop-color",
      "stop-opacity",
      "text-anchor",
      "font-size",
      "font-family",
      "font-weight",
      "clip-path",
      "clipPathUnits",
      "preserveAspectRatio",
      "marker-end",
      "marker-start",
      "points",
      "role",
      "aria-label",
      "aria-hidden",
    ],
  });
}
