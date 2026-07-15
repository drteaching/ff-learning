/**
 * Environment-aware public origin for Auth redirects.
 * Prefer the live browser origin on the client so localhost,
 * *.vercel.app previews, and custom domains (scola.com.au) all work.
 */
export function getSiteOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return `https://${productionHost.replace(/^https?:\/\//, "")}`;
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "")}`;
  }

  return "http://localhost:3000";
}

/** Safe in-app path only (blocks open redirects). */
export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

/**
 * OAuth / magic-link redirect target, e.g.
 * https://www.scola.com.au/auth/callback?next=/dashboard
 */
export function getOAuthRedirectTo(next: string = "/dashboard"): string {
  const origin = getSiteOrigin();
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}
