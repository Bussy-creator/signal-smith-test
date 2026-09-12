"use client";

import AdResultBanner from "./AdResultBanner";

interface Topic {
  id: string;
  name: string;
}
interface Mistake {
  questionText: string;
  yourAnswer: string | null;
  correctAnswer: string;
  explanation: string | null;
}

export default function ResultView({
  score,
  topicBreakdown,
  mistakes,
  topics
}: {
  score: number;
  topicBreakdown: Record<string, { correct: number; total: number }>;
  mistakes: Mistake[];
  topics: Topic[];
}) {
  const topicName = (id: string) => topics.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6">
      <AdResultBanner />

      <div className="text-center mb-6">
        <div className="text-4xl sm:text-5xl font-bold text-brand">{score}%</div>
        <p className="text-sm sm:text-base text-gray-500 mt-1">
          {score >= 70 ? "Excellent work!" : score >= 50 ? "Good effort — room to improve." : "Let's work on this one."}
        </p>
      </div>

      <h2 className="font-medium mb-3">Breakdown by topic</h2>
      <div className="space-y-2 mb-8">
        {Object.entries(topicBreakdown).map(([topicId, stats]) => {
          const pct = Math.round((stats.correct / stats.total) * 100);
          return (
            <div key={topicId} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{topicName(topicId)}</span>
              <span className="font-medium shrink-0">
                {stats.correct}/{stats.total} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>

      {mistakes.length > 0 ? (
        <>
          <h2 className="font-medium mb-3">
            Your mistakes and corrections ({mistakes.length})
          </h2>
          <div className="space-y-3 mb-8">
            {mistakes.map((m, i) => (
              <div
                key={i}
                className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm"
              >
                <p className="font-medium mb-2">{m.questionText}</p>
                <p className="text-red-700 dark:text-red-300">
                  Your answer: {m.yourAnswer ?? <span className="italic">No answer</span>}
                </p>
                <p className="text-green-700 dark:text-green-400 mb-1">
                  Correct answer: {m.correctAnswer}
                </p>
                {m.explanation && <p className="text-gray-500 dark:text-gray-400">{m.explanation}</p>}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-green-600 mb-8">Perfect score — no mistakes to review! 🎉</p>
      )}

      <a href="/dashboard" className="block text-center py-2 rounded border border-gray-300 dark:border-gray-700">
        Back to dashboard
      </a>
    </div>
  );
}
