/**
 * Resolve Supabase public env vars.
 * Accepts both the current publishable-key name and the legacy anon-key name,
 * so Vercel setups following older docs still work.
 */
export function getSupabaseUrl(): string | undefined {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  return value || undefined;
}

export function getSupabasePublishableKey(): string | undefined {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();
  return value || undefined;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function requireSupabasePublicEnv(): {
  url: string;
  key: string;
} {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in Vercel, then redeploy.",
    );
  }
  return { url, key };
}
