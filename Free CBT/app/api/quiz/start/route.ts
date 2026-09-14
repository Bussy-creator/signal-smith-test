import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const redis = Redis.fromEnv();
const POOL_CACHE_TTL = 60 * 30; // 30 min — question bank doesn't change mid-exam-window

interface QuestionRow {
  id: string;
  topic_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * POST /api/quiz/start
 * body: { courseId, mode: 'practice'|'exam', topicIds?: string[], questionCount?, timeLimitMinutes? }
 *
 * Exam mode pulls the FULL question pool for the course from Redis (cached
 * for 30 min, one Postgres read per course per cache window regardless of
 * how many of the 8,000 students are starting the exam right now), then
 * does an in-memory balanced draw across topics and a per-student shuffle.
 * This is the key mechanism that avoids per-student DB read locks at
 * exam-start peak.
 *
 * Defaults: practice mode has no fixed question count (the caller — the
 * topic picker — always passes an explicit, user-chosen count). Exam mode
 * defaults to a standard 30 questions / 30 minutes if not overridden.
 */
export async function POST(req: NextRequest) {
  // Bearer token is an optional, additive fallback alongside normal cookie
  // auth — see lib/supabase/server.ts. Used by load-testing tools.
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const supabase = createClient(bearer);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { courseId, mode, topicIds, questionCount = 30, timeLimitMinutes = 30 } = await req.json();

  const poolKey = `qpool:${courseId}`;
  let pool = (await redis.get(poolKey)) as QuestionRow[] | null;

  if (!pool) {
    // Uses the admin (service-role) client deliberately: the `questions`
    // table has RLS enabled with NO policy for the anon/authenticated
    // roles (see database/schema.sql), so a regular session-scoped query
    // here would return nothing. That's intentional — it means a student
    // can never query `questions` directly via the Supabase client and
    // read correct_option/explanation for the whole bank; the only path
    // to question data is through this route, which strips both before
    // sending anything back to the browser (see below). Explanations are
    // later revealed per-question, after an answer, via
    // /api/quiz/check-answer (practice mode) or in the post-submission
    // review (both modes).
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("questions")
      .select("id, topic_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation")
      .eq("course_id", courseId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    pool = data as QuestionRow[];
    await redis.set(poolKey, pool, { ex: POOL_CACHE_TTL });
  }

  let candidatePool = pool;
  if (mode === "practice" && Array.isArray(topicIds) && topicIds.length > 0) {
    candidatePool = pool.filter((q) => topicIds.includes(q.topic_id));
  }

  let selected: QuestionRow[];
  if (mode === "exam") {
    // Balanced distribution: draw evenly across every topic present in the course
    const byTopic = new Map<string, QuestionRow[]>();
    for (const q of candidatePool) {
      if (!byTopic.has(q.topic_id)) byTopic.set(q.topic_id, []);
      byTopic.get(q.topic_id)!.push(q);
    }
    const topics = [...byTopic.keys()];
    const perTopic = Math.max(1, Math.floor(questionCount / topics.length));
    selected = topics.flatMap((t) => shuffle(byTopic.get(t)!).slice(0, perTopic));
    selected = shuffle(selected).slice(0, questionCount);
  } else {
    selected = shuffle(candidatePool).slice(0, Math.min(questionCount, candidatePool.length));
  }

  // Randomize option order per student, per question, and store the mapping
  // so the client renders shuffled options but submission still maps back
  // to A/B/C/D correctness server-side.
  const attemptQuestions = selected.map((q) => {
    const options = shuffle([
      { key: "A", text: q.option_a },
      { key: "B", text: q.option_b },
      { key: "C", text: q.option_c },
      { key: "D", text: q.option_d }
    ]);
    return {
      question_id: q.id,
      topic_id: q.topic_id,
      question_text: q.question_text,
      options,
      correct_option: q.correct_option,
      explanation: q.explanation ?? null
    };
  });

  const { data: attempt, error: insertErr } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: user.id,
      course_id: courseId,
      mode,
      topic_ids: topicIds ?? [],
      // correct_option and explanation ARE stored here — needed
      // server-side for grading and per-question feedback. Both are
      // stripped from the JSON response below so neither reaches the
      // client bundle upfront. Note: because RLS lets a student SELECT
      // their own quiz_attempts row, a technically savvy student could
      // read attempt_questions directly via the Supabase client and see
      // both fields early. For production, add a Postgres VIEW or RPC
      // that returns attempt_questions with these fields stripped for
      // student-facing reads, and restrict direct table SELECT on
      // quiz_attempts to the service role only.
      attempt_questions: attemptQuestions,
      time_limit_seconds: mode === "exam" ? timeLimitMinutes * 60 : null
    })
    .select("id")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Return full question objects (correct_option/explanation stay
  // server-side only — client payload below omits both) plus attemptId.
  return NextResponse.json({
    attemptId: attempt.id,
    timeLimitSeconds: mode === "exam" ? timeLimitMinutes * 60 : null,
    questions: attemptQuestions.map(({ correct_option, explanation, ...rest }) => rest)
  });
}
