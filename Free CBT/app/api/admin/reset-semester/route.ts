import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/reset-semester
 *
 * Soft-resets every student's course enrollment (is_active = false, never
 * deleted — historical attempts/analytics are untouched). On next login,
 * the dashboard sees no active enrollment and re-shows the "What are you
 * offering this semester?" course-picker modal for every student.
 *
 * Click this once at the start of each new semester.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("user_course_enrollment")
    .update({ is_active: false }, { count: "exact" })
    .eq("is_active", true)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "Semester reset complete. All students will be asked to re-select their courses on next login.",
    enrollmentsReset: count ?? 0
  });
}
