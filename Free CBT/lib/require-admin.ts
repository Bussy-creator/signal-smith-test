import { createClient } from "@/lib/supabase/server";

/**
 * Verifies the current session belongs to a profile with is_admin = true.
 * Throws a Response (to be re-thrown/returned by the caller) if not.
 */
export async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: new Response("Unauthorized", { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { ok: false as const, response: new Response("Forbidden", { status: 403 }) };
  }

  return { ok: true as const, userId: user.id };
}
