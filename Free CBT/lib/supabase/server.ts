import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Used in Server Components / Route Handlers — respects the logged-in
// user's session and therefore their RLS policies.
//
// accessToken is optional and additive: normal cookie-based requests are
// completely unaffected. It exists so API routes can also authenticate a
// caller via `Authorization: Bearer <token>` (e.g. load testing tools that
// can't easily replicate @supabase/ssr's cookie session format). A valid
// Supabase-issued JWT is still required either way — this does not bypass
// auth, it just adds a second supported way to present it.
export async function createClient(accessToken?: string) {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        }
      },
      ...(accessToken
        ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        : {})
    }
  );
}

// Service-role client — bypasses RLS. ONLY use inside admin-guarded API
// routes (bulk upload, ad manager, semester reset), never expose to the
// client bundle.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
