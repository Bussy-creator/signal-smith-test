import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;
const redis = Redis.fromEnv();

/**
 * GET /api/admin/questions?course_id=<uuid>&search=<text>&page=<n>
 *
 * Lists questions for ONE course at a time, paginated — question banks
 * can run into the hundreds or thousands of rows per course (see the
 * PHY101 bulk-upload CSV), so this deliberately never loads a whole
 * course's bank in one response. Also returns that course's topics, so
 * the admin UI can populate the topic dropdown in the edit form without
 * a second route, and the course's total past-attempt count, so the UI
 * can warn appropriately before a purge (see DELETE below) without a
 * separate round trip.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const courseId = req.nextUrl.searchParams.get("course_id");
  if (!courseId) {
    return NextResponse.json({ error: "course_id is required." }, { status: 400 });
  }
  const search = req.nextUrl.searchParams.get("search")?.trim() || "";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createAdminClient();

  let query = supabase
    .from("questions")
    .select(
      "id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, topic_id, created_at, topics(name)",
      { count: "exact" }
    )
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.ilike("question_text", `%${search}%`);
  }

  const [{ data: questions, error, count }, { data: topics, error: topicsErr }, { count: attemptCount }] =
    await Promise.all([
      query,
      supabase.from("topics").select("id, name").eq("course_id", courseId).order("name"),
      supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("course_id", courseId)
    ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (topicsErr) return NextResponse.json({ error: topicsErr.message }, { status: 500 });

  return NextResponse.json({
    questions,
    topics,
    total: count ?? 0,
    attemptCount: attemptCount ?? 0,
    page,
    pageSize: PAGE_SIZE
  });
}

/**
 * DELETE /api/admin/questions?course_id=<uuid>
 *
 * Purges EVERY question belonging to a course in one shot — for cases
 * like "this bulk upload went wrong, start the bank over" rather than
 * deleting one question at a time. Topics are left alone (they're
 * typically reused when the course is re-uploaded), and past
 * quiz_attempts are unaffected (attempt_questions is a snapshot, not a
 * live reference) — same reasoning as the single-question DELETE in
 * questions/[id]/route.ts, just at course scale. The admin UI is
 * expected to have already shown attemptCount (from GET above) and
 * gotten explicit confirmation before calling this; this endpoint does
 * not re-check or ask again.
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const courseId = req.nextUrl.searchParams.get("course_id");
  if (!courseId) {
    return NextResponse.json({ error: "course_id is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("questions").delete().eq("course_id", courseId).select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await redis.del(`qpool:${courseId}`);

  return NextResponse.json({ deletedCount: data?.length ?? 0 });
}
