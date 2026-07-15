import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Auth-gated learning pages always hit cookies + Supabase — keep classic dynamic SSR. */
  // NOTE: do NOT add sanitize-html to serverExternalPackages. Externalizing it makes the
  // serverless runtime require() it at runtime, and its CommonJS entry require()s htmlparser2
  // (ESM-only since v12) -> ERR_REQUIRE_ESM, which 500s every lesson page on Vercel. Letting
  // Turbopack bundle it resolves the ESM/CJS interop. sanitize-html pulls in no jsdom, so
  // nothing problematic gets bundled.
};

export default nextConfig;
