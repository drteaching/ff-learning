import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/origin";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/dashboard");
  const errorDescription =
    searchParams.get("error_description") || searchParams.get("error");

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Prefer the host the user actually hit (custom domain / preview).
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal =
        process.env.NODE_ENV === "development" ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1");

      if (isLocal) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/auth/error?error=${encodeURIComponent("Missing OAuth code")}`,
  );
}
