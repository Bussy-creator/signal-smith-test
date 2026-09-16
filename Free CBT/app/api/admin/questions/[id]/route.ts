import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { adminWriteLimiter, rateLimitedResponse } from "@/lib/rate-limit";

// Same reasoning as bulk-upload/route.ts: /api/quiz/start caches each
// course's question pool in Redis for 30 min. Editing or deleting a
// question here without invalidating that cache means students could
// keep getting served the old (or deleted) version of a question for up
// to 30 minutes after an admin fixes or removes it.
const redis = Redis.fromEnv();

/**
 * GET /api/admin/questions/[id]
 *
 * Returns the question plus how many past quiz_attempts snapshot it, so
 * the admin UI can warn before deletion. attempt_questions is a JSONB
 * array of {question_id, options order, correct_option} per attempt —
 * `.contains` maps to Postgres's `@>` operator, which for jsonb arrays
 * recurses into each element, so this matches any attempt whose array
 * has an element containing question_id: <id>.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { success, reset } = await adminWriteLimiter.limit(admin.userId);
  if (!success) return rateLimitedResponse(reset);

  const supabase = createAdminClient();
  const { data: question, error } = await supabase
    .from("questions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const { count } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .contains("attempt_questions", [{ question_id: params.id }]);

  return NextResponse.json({ question, attemptReferenceCount: count ?? 0 });
}

/**
 * PUT /api/admin/questions/[id]
 * body: { question_text, option_a, option_b, option_c, option_d,
 *         correct_option, explanation, topic_id }
 *
 * content_hash is intentionally left untouched here — it's a dedup key
 * against future bulk uploads for the same course, not a display field,
 * and recomputing it on every text edit would let an edited question
 * collide with (or fail to dedup against) a re-uploaded original.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { success, reset } = await adminWriteLimiter.limit(admin.userId);
  if (!success) return rateLimitedResponse(reset);

  const body = await req.json();
  const { question_text, option_a, option_b, option_c, option_d, correct_option, explanation, topic_id } = body;

  if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_option || !topic_id) {
    return NextResponse.json({ error: "All fields except explanation are required." }, { status: 400 });
  }
  if (!["A", "B", "C", "D"].includes(String(correct_option).toUpperCase())) {
    return NextResponse.json({ error: "correct_option must be A, B, C, or D." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .update({
      question_text: String(question_text).trim(),
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option: String(correct_option).toUpperCase(),
      explanation: explanation ?? "",
      topic_id
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (data?.course_id) await redis.del(`qpool:${data.course_id}`);

  return NextResponse.json({ question: data });
}

/**
 * DELETE /api/admin/questions/[id]
 *
 * Always allowed — per product decision, quiz_attempts.attempt_questions
 * snapshots each question's text/options/correct answer at attempt time,
 * so deleting the source question here does not affect any past
 * attempt's stored record or score. The admin UI is expected to have
 * already warned the admin (via the attemptReferenceCount from GET
 * above) before calling this; this endpoint does not re-check.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { success, reset } = await adminWriteLimiter.limit(admin.userId);
  if (!success) return rateLimitedResponse(reset);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .delete()
    .eq("id", params.id)
    .select("course_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data?.course_id) await redis.del(`qpool:${data.course_id}`);

  return NextResponse.json({ ok: true });
}
