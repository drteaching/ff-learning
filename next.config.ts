import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Auth-gated learning pages always hit cookies + Supabase — keep classic dynamic SSR. */
};

export default nextConfig;
