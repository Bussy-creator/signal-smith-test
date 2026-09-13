import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/server";

const redis = Redis.fromEnv();
const POOL_CACHE_TTL = 60 * 30; // matches /api/quiz/start's cache window

/**
 * GET /api/admin/courses/health
 *
 * For every course: counts topics and questions, flags courses with no
 * questions at all ("empty") or with some topics that have zero
 * questions ("warning" — practice-by-topic will just show those as
 * unselectable, not broken, but worth knowing about).
 *
 * As a deliberate side effect, this also REFRESHES each course's cached
 * question pool (the same qpool:<courseId> key /api/quiz/start reads) to
 * match the database right now. Every write path (bulk upload, question
 * edit/delete) already invalidates this cache on its own, so this
 * shouldn't normally be necessary — but it gives the admin a manual
 * "force sync" button for the rare case something falls through (a
 * direct DB edit, a missed invalidation elsewhere, etc.), and it means
 * running this check can never itself leave a course worse off.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createAdminClient();
  const { data: courses, error } = await supabase.from("courses").select("id, code, title").order("code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.all(
    (courses ?? []).map(async (course) => {
      const [{ data: topics }, { data: questions, error: qErr }] = await Promise.all([
        supabase.from("topics").select("id").eq("course_id", course.id),
        supabase
          .from("questions")
          .select("id, topic_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation")
          .eq("course_id", course.id)
      ]);

      if (qErr) {
        return {
          id: course.id,
          code: course.code,
          title: course.title,
          topicCount: topics?.length ?? 0,
          questionCount: 0,
          status: "error" as const,
          message: `Could not read questions: ${qErr.message}`
        };
      }

      // Keep the cache in sync with what we just read, regardless of status.
      await redis.set(`qpool:${course.id}`, questions ?? [], { ex: POOL_CACHE_TTL });

      const topicIdsWithQuestions = new Set((questions ?? []).map((q) => q.topic_id));
      const topicsWithoutQuestions = (topics ?? []).filter((t) => !topicIdsWithQuestions.has(t.id)).length;

      let status: "ok" | "empty" | "warning" = "ok";
      let message = `${questions?.length ?? 0} question(s) across ${topics?.length ?? 0} topic(s).`;

      if (!questions || questions.length === 0) {
        status = "empty";
        message = topics && topics.length > 0
          ? `${topics.length} topic(s) but zero questions \u2014 practice/exam will show nothing.`
          : "No topics or questions yet.";
      } else if (topicsWithoutQuestions > 0) {
        status = "warning";
        message += ` ${topicsWithoutQuestions} topic(s) have zero questions.`;
      }

      return {
        id: course.id,
        code: course.code,
        title: course.title,
        topicCount: topics?.length ?? 0,
        questionCount: questions.length,
        status,
        message
      };
    })
  );

  return NextResponse.json({ courses: results });
}
