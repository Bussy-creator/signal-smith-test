import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { quizSubmitLimiter, rateLimitedResponse } from "@/lib/rate-limit";

interface AttemptOption {
  key: "A" | "B" | "C" | "D";
  text: string;
}
interface AttemptQuestion {
  question_id: string;
  topic_id: string;
  question_text: string;
  options: AttemptOption[];
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
}
interface AnswerEntry {
  answer: "A" | "B" | "C" | "D" | null;
  time_spent_seconds: number;
  flagged: boolean;
}

/**
 * POST /api/quiz/submit
 * body: { attemptId, answers: Record<question_id, AnswerEntry>, autoSubmitted }
 *
 * A single indexed write per submission — see README §3 for why attempts
 * are stored as JSONB rather than a per-question join table.
 *
 * Also builds a `review` array — every question the student got wrong,
 * with their answer, the correct one, and its explanation — so the result
 * screen can show "your mistakes and their corrections" for both practice
 * and exam mode.
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

  const { success, reset } = await quizSubmitLimiter.limit(user.id);
  if (!success) return rateLimitedResponse(reset);

  const body = await req.json();
  const { attemptId, answers, autoSubmitted } = body as {
    attemptId: string;
    answers: Record<string, AnswerEntry>;
    autoSubmitted: boolean;
  };

  const { data: attempt, error: fetchErr } = await supabase
    .from("quiz_attempts")
    .select("id, user_id, attempt_questions")
    .eq("id", attemptId)
    .single();

  if (fetchErr || !attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const questions = attempt.attempt_questions as AttemptQuestion[];
  const topicTally: Record<string, { correct: number; total: number }> = {};
  let correctCount = 0;
  const mistakes: Array<{
    questionText: string;
    yourAnswer: string | null;
    correctAnswer: string;
    explanation: string | null;
  }> = [];

  for (const q of questions) {
    const given = answers[q.question_id];
    const isCorrect = given?.answer === q.correct_option;
    if (isCorrect) correctCount += 1;

    if (!topicTally[q.topic_id]) topicTally[q.topic_id] = { correct: 0, total: 0 };
    topicTally[q.topic_id].total += 1;
    if (isCorrect) topicTally[q.topic_id].correct += 1;

    if (!isCorrect) {
      const yourOpt = q.options.find((o) => o.key === given?.answer);
      const correctOpt = q.options.find((o) => o.key === q.correct_option);
      mistakes.push({
        questionText: q.question_text,
        yourAnswer: yourOpt?.text ?? (given?.answer ? given.answer : null),
        correctAnswer: correctOpt?.text ?? q.correct_option,
        explanation: q.explanation ?? null
      });
    }
  }

  const score = questions.length > 0 ? Number(((correctCount / questions.length) * 100).toFixed(2)) : 0;

  const { data: updated, error: updateErr } = await supabase
    .from("quiz_attempts")
    .update({
      attempt_answers: answers,
      score,
      topic_breakdown: topicTally,
      submitted_at: new Date().toISOString(),
      auto_submitted: !!autoSubmitted
    })
    .eq("id", attemptId)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ score, topicBreakdown: topicTally, mistakes, attempt: updated });
}
