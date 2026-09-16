import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for Supabase's email-link auth flows (password reset,
 * email confirmation). Supabase redirects the user's browser here with a
 * `?code=...` param; exchanging it for a session sets the actual
 * `@supabase/ssr` cookies via createClient()'s cookie handlers, so the
 * user is genuinely logged in by the time they hit `next`.
 *
 * `next` defaults to /dashboard so a plain email-confirmation link (no
 * `next` param) still lands somewhere sensible; the forgot-password flow
 * explicitly passes next=/reset-password.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("auth/callback: exchangeCodeForSession failed", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
