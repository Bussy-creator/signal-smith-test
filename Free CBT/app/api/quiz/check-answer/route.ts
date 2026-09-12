import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface AttemptQuestion {
  question_id: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
}

/**
 * POST /api/quiz/check-answer
 * body: { attemptId, questionId, answer }
 *
 * Practice-mode-only: reveals whether a single answer is correct, plus
 * the correct option and its explanation, immediately after the student
 * picks it — without ever sending the full answer key to the browser
 * upfront. Deliberately refuses to run in exam mode (see below) so a
 * student can't use this endpoint to peek at answers mid-exam.
 *
 * No write happens here — the definitive answer record is whatever the
 * student's browser sends to /api/quiz/submit at the end, same as before.
 * This route only reads the attempt's stored answer key to compare.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId, questionId, answer } = await req.json();
  if (!attemptId || !questionId) {
    return NextResponse.json({ error: "attemptId and questionId are required." }, { status: 400 });
  }

  const { data: attempt, error } = await supabase
    .from("quiz_attempts")
    .select("user_id, mode, attempt_questions")
    .eq("id", attemptId)
    .single();

  if (error || !attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  if (attempt.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (attempt.mode !== "practice") {
    return NextResponse.json({ error: "Answer checking is only available in practice mode." }, { status: 403 });
  }

  const questions = attempt.attempt_questions as AttemptQuestion[];
  const q = questions.find((x) => x.question_id === questionId);
  if (!q) return NextResponse.json({ error: "Question not in this attempt." }, { status: 404 });

  return NextResponse.json({
    correct: answer === q.correct_option,
    correctOption: q.correct_option,
    explanation: q.explanation ?? null
  });
}
