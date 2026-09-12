import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifies the current session belongs to a profile with is_admin = true.
 * Every admin API route does `if (!admin.ok) return admin.response;` and
 * the client-side code always does `await res.json()` on the result —
 * so admin.response MUST be JSON, never plain text, or every admin
 * feature crashes with a JSON.parse error the moment a session lapses
 * or an admin check fails (this used to return `new Response("Unauthorized")`,
 * a plain-text body, which is exactly what was happening).
 *
 * Also distinguishes "genuinely not authorized" (401/403) from "couldn't
 * verify right now" (503, on a thrown error talking to Supabase) — a
 * transient network hiccup shouldn't look identical to being logged out.
 */
export async function requireAdmin() {
  try {
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Please log in again." }, { status: 401 })
      };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Admin access required." }, { status: 403 })
      };
    }

    return { ok: true as const, userId: user.id };
  } catch (err) {
    console.error("requireAdmin: auth check failed", err);
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Could not verify admin access right now. Please try again in a moment." },
        { status: 503 }
      )
    };
  }
}
