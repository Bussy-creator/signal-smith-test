import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

/**
 * Server-side guard, independent of middleware.ts. Two layers checking the
 * same thing isn't redundant here — it's the difference between "an
 * unauthenticated request never reaches this page" (middleware, fast,
 * edge-level) and "even if something is misconfigured or this page is
 * reached another way, a non-admin still can't render the admin UI"
 * (this file). Same pattern as /dashboard/page.tsx.
 *
 * The auth check itself is wrapped in try/catch: if it throws (a
 * transient network issue talking to Supabase, not "you're logged out"),
 * we deliberately do NOT redirect to /login — that produced the
 * confusing "reload sent me to login for no reason" bug. Instead this
 * shows a small retry prompt so it's clear what happened and what to do,
 * rather than silently bouncing an actually-logged-in admin.
 */
export default async function AdminPage() {
  try {
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) redirect("/dashboard");

    return <AdminClient />;
  } catch (err: any) {
    // redirect() throws internally to unwind the render — that's not a
    // real error, so let it propagate rather than treating it as a
    // connection failure below.
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;

    console.error("AdminPage: auth check failed", err);
    return (
      <div className="max-w-md mx-auto mt-24 text-center space-y-3">
        <h1 className="text-lg font-medium">Couldn't verify your session</h1>
        <p className="text-sm text-gray-500">
          This is usually a temporary connection issue, not a login problem — your session should
          still be valid. Try reloading in a moment.
        </p>
        <a href="/admin" className="inline-block px-4 py-2 rounded bg-brand text-white text-sm">
          Reload
        </a>
      </div>
    );
  }
}
