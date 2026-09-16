import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { publicReadLimiter, rateLimitedResponse } from "@/lib/rate-limit";

/**
 * GET /api/courses/[courseId]/topics
 *
 * Returns each topic in the course plus how many questions it has. Any
 * logged-in student can call this (no admin check) — it's needed for the
 * practice-mode topic picker. Uses the admin client only because
 * `questions` has no client-facing RLS policy at all (see schema.sql);
 * this route never returns question text, options, or answers — just a
 * per-topic count — so exposing it to regular students is safe.
 */
export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success, reset } = await publicReadLimiter.limit(user.id);
  if (!success) return rateLimitedResponse(reset);

  const admin = createAdminClient();

  const { data: topics, error: topicsErr } = await admin
    .from("topics")
    .select("id, name")
    .eq("course_id", params.courseId);
  if (topicsErr) return NextResponse.json({ error: topicsErr.message }, { status: 500 });

  const { data: questions, error: qErr } = await admin
    .from("questions")
    .select("topic_id")
    .eq("course_id", params.courseId);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const q of questions ?? []) {
    counts.set(q.topic_id, (counts.get(q.topic_id) ?? 0) + 1);
  }

  const result = (topics ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    questionCount: counts.get(t.id) ?? 0
  }));

  return NextResponse.json({ topics: result });
}
