"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import QuizEngine from "@/components/QuizEngine";
import ResultView from "@/components/ResultView";

const EXAM_QUESTION_COUNT = 30;
const EXAM_MINUTES = 30;

interface Mistake {
  questionText: string;
  yourAnswer: string | null;
  correctAnswer: string;
  explanation: string | null;
}

export default function ExamPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [session, setSession] = useState<null | { attemptId: string; questions: any[]; timeLimitSeconds: number }>(
    null
  );
  const [result, setResult] = useState<null | {
    score: number;
    topicBreakdown: any;
    mistakes: Mistake[];
  }>(null);
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    const res = await fetch("/api/quiz/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        mode: "exam",
        questionCount: EXAM_QUESTION_COUNT,
        timeLimitMinutes: EXAM_MINUTES
      })
    });
    const data = await res.json();
    setSession({ attemptId: data.attemptId, questions: data.questions, timeLimitSeconds: data.timeLimitSeconds });
    setStarting(false);
  }

  if (result)
    return (
      <ResultView
        score={result.score}
        topicBreakdown={result.topicBreakdown}
        mistakes={result.mistakes}
        topics={[]}
      />
    );

  if (session) {
    return (
      <QuizEngine
        attemptId={session.attemptId}
        questions={session.questions}
        mode="exam"
        timeLimitSeconds={session.timeLimitSeconds}
        courseCode="Exam"
        showCalculator
        onSubmitted={setResult}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 text-center">
      <h1 className="text-xl font-semibold mb-3">Exam Simulation</h1>
      <p className="text-sm text-gray-500 mb-6">
        {EXAM_QUESTION_COUNT} questions, balanced across every topic in this course. A{" "}
        {EXAM_MINUTES}-minute countdown timer — the exam auto-submits the moment time runs out.
        Question and option order is randomized just for you. Mistakes and their corrections are
        shown once you finish.
      </p>
      <button
        onClick={start}
        disabled={starting}
        className="w-full py-2 rounded bg-brand text-white disabled:opacity-60"
      >
        {starting ? "Preparing exam…" : "Start Exam"}
      </button>
    </div>
  );
}
