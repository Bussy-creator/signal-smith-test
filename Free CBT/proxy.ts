import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ipFloodLimiter, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

export async function proxy(request: NextRequest) {
  // Force HTTPS. Vercel's edge network already redirects http→https for
  // every deployment, so in normal operation this should never actually
  // fire — it's defense-in-depth for the case of a custom domain whose
  // DNS/proxy setup ever bypasses that, not a gap that exists today.
  // Only enforce in production — Next's dev server (Next 16+) sets
  // x-forwarded-proto: http on every local request itself, so this used
  // to fire unconditionally in dev and redirect localhost to a
  // non-existent HTTPS listener. Restrict the check to production, which
  // is the only environment this defense-in-depth guard is meant for.
  const proto = request.headers.get("x-forwarded-proto");
  if (process.env.NODE_ENV === "production" && proto === "http") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  // API routes: flood protection only, keyed by IP, ahead of everything
  // else. Deliberately skips the cookie/session logic below entirely —
  // each API route already does its own auth check (see lib/supabase/server.ts
  // usage in each route), so redoing it here would just be wasted work.
  // See lib/rate-limit.ts for why this limiter is generous rather than
  // strict (shared campus/hostel NAT IPs).
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const { success, reset } = await ipFloodLimiter.limit(ip);
    if (!success) return rateLimitedResponse(reset);
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  // Everything below this point only matters for /dashboard, /quiz, and
  // /admin (auth-gated pages). For every other page (/, /login,
  // /register, etc.) there's nothing left to check — skip building a
  // Supabase client and making a real network call to its auth server on
  // every public page load, now that this middleware runs broadly (see
  // matcher below) rather than just on protected paths.
  const protectedPaths = ["/dashboard", "/quiz", "/admin"];
  const isProtectedPath = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!isProtectedPath) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  // supabase.auth.getUser() makes a real network call to Supabase's auth
  // server on EVERY request to a protected path, including plain reloads.
  // If that call throws (a transient network hiccup, or Supabase being
  // slow under load) it must not be treated the same as "not logged in" —
  // that was sending genuinely logged-in users to /login on reload for no
  // visible reason. On failure here, fail OPEN at this edge layer only:
  // let the request through and let the page-level guard (admin/page.tsx,
  // dashboard/page.tsx) or the API route guard (requireAdmin) do their
  // own fresh check a moment later. Those still fail closed, so this
  // doesn't weaken security — it just avoids a false negative at the
  // fastest, flakiest layer.
  let user = null;
  try {
    const {
      data: { user: fetchedUser }
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch (err) {
    console.error("middleware: supabase.auth.getUser() failed, deferring to page-level auth check", err);
    return response;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // /admin needs more than "logged in" — it needs is_admin = true. Without
  // this, any registered student could open /admin directly by URL and see
  // the course/question/ad management UI (the underlying API routes are
  // separately guarded by requireAdmin(), so no data could actually be
  // changed — but showing the controls at all is a confusing, unnecessary
  // leak). Query the user's own profile row, which RLS already permits
  // them to read.
  if (request.nextUrl.pathname.startsWith("/admin") && user) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch (err) {
      // Same reasoning as the getUser() catch above: don't punish a real
      // admin with a bounce to /dashboard because this one query hiccuped.
      // admin/page.tsx re-checks is_admin itself right after this.
      console.error("middleware: is_admin lookup failed, deferring to page-level check", err);
      return response;
    }
  }

  return response;
}

export const config = {
  // Broad catch-all (excluding Next's static/image assets and the
  // favicon) so the HTTPS-force check above genuinely covers every
  // route, not just the ones needing auth/rate-limit logic — the
  // pathname branches inside middleware() handle the rest per-route.
  matcher: ["/((?!_next/static|_next/image|.*\\.svg$).*)"]
};
