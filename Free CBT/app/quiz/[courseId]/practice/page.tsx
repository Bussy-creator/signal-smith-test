"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import QuizEngine from "@/components/QuizEngine";
import ResultView from "@/components/ResultView";
import LoadingScreen from "@/components/LoadingScreen";

interface Topic {
  id: string;
  name: string;
  questionCount: number;
}
interface Mistake {
  questionText: string;
  yourAnswer: string | null;
  correctAnswer: string;
  explanation: string | null;
}

const DEFAULT_COUNT = 20;

export default function PracticePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(DEFAULT_COUNT);
  const [session, setSession] = useState<null | { attemptId: string; questions: any[] }>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<null | {
    score: number;
    topicBreakdown: any;
    mistakes: Mistake[];
  }>(null);

  useEffect(() => {
    setLoadingTopics(true);
    fetch(`/api/courses/${courseId}/topics`)
      .then((r) => r.json())
      .then((data) => setTopics(data.topics ?? []))
      .finally(() => setLoadingTopics(false));
  }, [courseId]);

  function toggleTopic(id: string) {
    setSelectedTopics((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  // Available question pool shrinks/grows with which topics are checked —
  // this is what the editable count is clamped against.
  const availableCount = useMemo(() => {
    const relevant = selectedTopics.length === 0 ? topics : topics.filter((t) => selectedTopics.includes(t.id));
    return relevant.reduce((sum, t) => sum + t.questionCount, 0);
  }, [topics, selectedTopics]);

  useEffect(() => {
    // Keep the requested count sane whenever the available pool changes
    // (e.g. the student narrows down to a topic with fewer questions).
    setQuestionCount((c) => Math.max(1, Math.min(c, Math.max(availableCount, 1))));
  }, [availableCount]);

  async function start() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          mode: "practice",
          topicIds: selectedTopics,
          questionCount: Math.min(questionCount, availableCount)
        })
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.questions)) {
        setStartError(data.error ?? "Couldn't start practice — please try again.");
        return;
      }
      setSession({ attemptId: data.attemptId, questions: data.questions });
    } catch {
      setStartError("Network error — check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  if (starting) return <LoadingScreen message="Preparing your practice session…" />;

  if (loadingTopics) return <LoadingScreen message="Loading topics…" />;

  if (result)
    return (
      <ResultView
        score={result.score}
        topicBreakdown={result.topicBreakdown}
        mistakes={result.mistakes}
        topics={topics.map(({ id, name }) => ({ id, name }))}
      />
    );

  if (session) {
    return (
      <QuizEngine
        attemptId={session.attemptId}
        questions={session.questions}
        mode="practice"
        timeLimitSeconds={null}
        courseCode="Practice"
        showCalculator
        onSubmitted={setResult}
      />
    );
  }

  const hasAnyQuestions = availableCount > 0;

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6">
      <h1 className="text-xl font-semibold mb-4">Choose topics to practice</h1>
      <p className="text-sm text-gray-500 mb-4">
        Pick one or more topics, or leave everything unchecked to practice across all of them. No
        time limit — you'll see whether each answer is right or wrong as soon as you pick it.
      </p>
      <div className="space-y-2 mb-6">
        {topics.length === 0 ? (
          <p className="text-sm text-gray-500">No topics found for this course yet.</p>
        ) : (
          topics.map((t) => (
            <label
              key={t.id}
              className={`flex items-center justify-between gap-2 text-sm ${
                t.questionCount === 0 ? "opacity-40" : ""
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedTopics.includes(t.id)}
                  onChange={() => toggleTopic(t.id)}
                  disabled={t.questionCount === 0}
                  className="shrink-0"
                />
                <span className="truncate">{t.name}</span>
              </span>
              <span className="text-xs text-gray-400 shrink-0">
                {t.questionCount} question{t.questionCount === 1 ? "" : "s"}
              </span>
            </label>
          ))
        )}
      </div>

      {hasAnyQuestions && (
        <div className="mb-6">
          <label className="block text-sm mb-1">
            Number of questions <span className="text-gray-400">(up to {availableCount} available)</span>
          </label>
          <input
            type="number"
            min={1}
            max={availableCount}
            value={questionCount}
            onChange={(e) => {
              const v = Number(e.target.value) || 1;
              setQuestionCount(Math.max(1, Math.min(v, availableCount)));
            }}
            className="w-24 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
          />
        </div>
      )}

      <button
        onClick={start}
        disabled={!hasAnyQuestions || starting}
        className="w-full py-2 rounded bg-brand text-white disabled:opacity-60"
      >
        {starting ? "Starting…" : selectedTopics.length === 0 ? "Practice all topics" : "Start practice"}
      </button>
      {startError && <p className="text-sm text-red-500 mt-2">{startError}</p>}
    </div>
  );
}
