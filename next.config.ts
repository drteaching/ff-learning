import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Auth-gated learning pages always hit cookies + Supabase — keep classic dynamic SSR. */
  // Avoid bundling accidental jsdom leftovers if a dependency pulls them in.
  serverExternalPackages: ["sanitize-html"],
};

export default nextConfig;
