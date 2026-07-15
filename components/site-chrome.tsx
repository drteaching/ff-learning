import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import { EnvVarWarning } from "@/components/env-var-warning";
import { createClient } from "@/lib/supabase/server";

async function AdminNavLink() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return null;

  return (
    <Link href="/admin" className="hidden text-ff-accent hover:text-white sm:inline">
      Admin
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-ff-border bg-ff-ink text-white">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Link href="/" className="group flex flex-col leading-tight">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ff-accent">
            Clinical Education
          </span>
          <span className="font-display text-lg tracking-wide text-white group-hover:text-ff-accent-tint">
            SCOLA
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="hidden text-white/80 hover:text-white sm:inline"
          >
            Catalogue
          </Link>
          <Link
            href="/dashboard"
            className="hidden text-white/80 hover:text-white sm:inline"
          >
            Dashboard
          </Link>
          <Suspense fallback={null}>
            <AdminNavLink />
          </Suspense>
          {!hasEnvVars() ? (
            <EnvVarWarning />
          ) : (
            <Suspense fallback={<span className="text-white/60">…</span>}>
              <AuthButton />
            </Suspense>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ff-border bg-ff-card">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 text-center text-xs text-ff-muted sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <div>
          <p className="font-display text-base text-ff-ink">SCOLA</p>
          <p className="mt-0.5">
            Structured Clinical Online Learning &amp; Assessment
          </p>
        </div>
        <p>No patient-identifiable data is stored on this platform.</p>
      </div>
    </footer>
  );
}
