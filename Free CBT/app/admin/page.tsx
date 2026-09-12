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
 */
export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  return <AdminClient />;
}
