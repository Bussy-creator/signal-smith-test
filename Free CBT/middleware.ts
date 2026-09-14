import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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

  const protectedPaths = ["/dashboard", "/quiz", "/admin"];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !user) {
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
  matcher: ["/dashboard/:path*", "/quiz/:path*", "/admin/:path*"]
};
