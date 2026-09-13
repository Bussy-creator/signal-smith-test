"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Calculator from "./Calculator";
import AdWatermark from "./AdWatermark";

interface Option {
  key: "A" | "B" | "C" | "D";
  text: string;
}
interface Question {
  question_id: string;
  topic_id: string;
  question_text: string;
  options: Option[];
}
interface AnswerState {
  answer: "A" | "B" | "C" | "D" | null;
  time_spent_seconds: number;
  flagged: boolean;
}
interface CheckedState {
  correct: boolean;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string | null;
}
interface Mistake {
  questionText: string;
  yourAnswer: string | null;
  correctAnswer: string;
  explanation: string | null;
}

interface Props {
  attemptId: string;
  questions: Question[];
  mode: "practice" | "exam";
  timeLimitSeconds: number | null;
  courseCode: string;
  showCalculator: boolean;
  onSubmitted: (result: {
    score: number;
    topicBreakdown: Record<string, { correct: number; total: number }>;
    mistakes: Mistake[];
  }) => void;
}

const localKey = (attemptId: string) => `freecbt:attempt:${attemptId}`;

export default function QuizEngine({
  attemptId,
  questions,
  mode,
  timeLimitSeconds,
  courseCode,
  showCalculator,
  onSubmitted
}: Props) {
  const [current, setCurrent] = useState(0);
  const [loaded] = useState(() => {
    // Offline/resume support: restore from localStorage if this attempt was interrupted
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem(localKey(attemptId));
    if (!saved) return null;
    try {
      return JSON.parse(saved) as { answers: Record<string, AnswerState>; checked: Record<string, CheckedState> };
    } catch {
      return null;
    }
  });
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(
    loaded?.answers ??
      Object.fromEntries(questions.map((q) => [q.question_id, { answer: null, time_spent_seconds: 0, flagged: false }]))
  );
  // Practice-mode-only: once a question has been answered and checked,
  // this holds whether it was correct, the correct option, and its
  // explanation — shown inline instead of waiting for final submission.
  const [checked, setChecked] = useState<Record<string, CheckedState>>(loaded?.checked ?? {});
  const [checking, setChecking] = useState(false);
  const [remaining, setRemaining] = useState(timeLimitSeconds ?? 0);
  const [showCalc, setShowCalc] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const questionStartRef = useRef<number>(Date.now());

  // Persist every answer/check change to localStorage immediately — this
  // is the "offline progress sync" requirement: if the connection drops
  // mid-quiz, both the answers AND the practice-mode feedback already
  // shown survive a refresh/reconnect.
  useEffect(() => {
    window.localStorage.setItem(localKey(attemptId), JSON.stringify({ answers, checked }));
  }, [answers, checked, attemptId]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const submit = useCallback(
    async (autoSubmitted: boolean) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, answers, autoSubmitted })
        });
        const data = await res.json();
        if (res.ok) {
          window.localStorage.removeItem(localKey(attemptId));
          onSubmitted({ score: data.score, topicBreakdown: data.topicBreakdown, mistakes: data.mistakes ?? [] });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [attemptId, answers, onSubmitted]
  );

  // Countdown timer — exam mode only. Auto-submits at zero.
  useEffect(() => {
    if (mode !== "exam" || !timeLimitSeconds) return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          submit(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, timeLimitSeconds, submit]);

  // Defensive: this should be unreachable now that /api/quiz/start's
  // cache is invalidated on question upload/edit/delete (see
  // bulk-upload/route.ts and admin/questions/[id]/route.ts), but a
  // course/topic combo that genuinely has zero questions — or any other
  // future path that hands this component an empty array — should show
  // a message, not crash on `questions[current]` being undefined.
  if (questions.length === 0) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-3">
        <p className="text-sm text-gray-500">
          No questions came back for this attempt. This can happen right after new questions are
          uploaded — try going back and starting again in a moment.
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 text-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  const q = questions[current];
  const currentChecked = checked[q.question_id];

  function recordTimeOnCurrentQuestion() {
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    setAnswers((prev) => ({
      ...prev,
      [q.question_id]: {
        ...prev[q.question_id],
        time_spent_seconds: (prev[q.question_id]?.time_spent_seconds ?? 0) + elapsed
      }
    }));
    questionStartRef.current = Date.now();
  }

  async function selectAnswer(key: Option["key"]) {
    // Once a practice question has been checked, the answer is locked —
    // re-picking wouldn't make pedagogical sense once the correct answer
    // is already shown.
    if (mode === "practice" && currentChecked) return;

    setAnswers((prev) => ({ ...prev, [q.question_id]: { ...prev[q.question_id], answer: key } }));

    if (mode === "practice") {
      setChecking(true);
      try {
        const res = await fetch("/api/quiz/check-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, questionId: q.question_id, answer: key })
        });
        if (res.ok) {
          const data = await res.json();
          setChecked((prev) => ({
            ...prev,
            [q.question_id]: { correct: data.correct, correctOption: data.correctOption, explanation: data.explanation }
          }));
        }
      } finally {
        setChecking(false);
      }
    }
  }

  function toggleFlag() {
    setAnswers((prev) => ({
      ...prev,
      [q.question_id]: { ...prev[q.question_id], flagged: !prev[q.question_id]?.flagged }
    }));
  }

  function goTo(index: number) {
    recordTimeOnCurrentQuestion();
    setCurrent(index);
  }

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <div className="relative max-w-3xl mx-auto p-3 sm:p-4">
      <AdWatermark />

      {!isOnline && (
        <div className="mb-3 rounded bg-amber-100 text-amber-900 text-xs sm:text-sm px-3 py-2 dark:bg-amber-900/40 dark:text-amber-200">
          You're offline — your answers are being saved locally and will sync once you're back online.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-4">
        <span className="text-xs sm:text-sm text-gray-500 truncate">
          {courseCode} · {mode === "exam" ? "Exam Mode" : "Practice Mode"}
        </span>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {showCalculator && (
            <button
              onClick={() => setShowCalc((s) => !s)}
              aria-label="Toggle calculator"
              className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded border border-gray-300 dark:border-gray-700 whitespace-nowrap"
            >
              🧮 <span className="hidden sm:inline">Calculator</span>
            </button>
          )}
          {mode === "exam" && timeLimitSeconds !== null && (
            <span className="font-mono text-base sm:text-lg tabular-nums">{minutes}:{seconds}</span>
          )}
        </div>
      </div>

      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}

      <div className="mb-2 text-xs text-gray-400">
        Question {current + 1} of {questions.length}
      </div>
      <p className="text-base sm:text-lg font-medium mb-4">{q.question_text}</p>

      <div className="space-y-2 mb-4">
        {q.options.map((opt) => {
          const isSelected = answers[q.question_id]?.answer === opt.key;
          const isCorrectOpt = currentChecked && opt.key === currentChecked.correctOption;
          const isWrongSelected = currentChecked && isSelected && !currentChecked.correct;
          return (
            <button
              key={opt.key}
              onClick={() => selectAnswer(opt.key)}
              disabled={mode === "practice" && !!currentChecked}
              className={`w-full text-left px-4 py-3 rounded border transition ${
                isCorrectOpt
                  ? "border-green-500 bg-green-50 dark:bg-green-900/30"
                  : isWrongSelected
                  ? "border-red-500 bg-red-50 dark:bg-red-900/30"
                  : isSelected
                  ? "border-brand bg-brand-light dark:bg-brand-dark/30"
                  : "border-gray-200 dark:border-gray-800 hover:border-brand"
              } ${mode === "practice" && currentChecked ? "cursor-default" : ""}`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      {mode === "practice" && checking && (
        <p className="text-xs text-gray-400 mb-4">Checking…</p>
      )}

      {mode === "practice" && currentChecked && (
        <div
          className={`mb-6 rounded-lg p-3 text-sm ${
            currentChecked.correct
              ? "bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200"
          }`}
        >
          <p className="font-medium mb-1">
            {currentChecked.correct ? "✅ Correct!" : "❌ Not quite."}
          </p>
          {currentChecked.explanation && <p className="opacity-90">{currentChecked.explanation}</p>}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={toggleFlag}
          className={`text-sm px-3 py-2 sm:py-1 rounded border w-full sm:w-auto ${
            answers[q.question_id]?.flagged
              ? "border-amber-500 text-amber-600"
              : "border-gray-300 dark:border-gray-700"
          }`}
        >
          {answers[q.question_id]?.flagged ? "★ Marked for review" : "☆ Mark for review"}
        </button>

        <div className="flex gap-2">
          <button
            disabled={current === 0}
            onClick={() => goTo(current - 1)}
            className="flex-1 sm:flex-none px-4 py-2 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
          >
            Previous
          </button>
          {current < questions.length - 1 ? (
            <button
              onClick={() => goTo(current + 1)}
              className="flex-1 sm:flex-none px-4 py-2 rounded bg-brand text-white"
            >
              Next
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={() => {
                recordTimeOnCurrentQuestion();
                submit(false);
              }}
              className="flex-1 sm:flex-none px-4 py-2 rounded bg-brand text-white disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      </div>

      {/* Question navigator with flag indicators */}
      <div className="mt-6 flex flex-wrap gap-1.5">
        {questions.map((qq, i) => {
          const a = answers[qq.question_id];
          const c = checked[qq.question_id];
          return (
            <button
              key={qq.question_id}
              onClick={() => goTo(i)}
              className={`w-7 h-7 sm:w-8 sm:h-8 text-xs rounded border flex items-center justify-center
                ${i === current ? "border-brand" : "border-gray-200 dark:border-gray-800"}
                ${
                  c
                    ? c.correct
                      ? "bg-green-100 dark:bg-green-900/40"
                      : "bg-red-100 dark:bg-red-900/40"
                    : a?.flagged
                    ? "bg-amber-100 dark:bg-amber-900/40"
                    : a?.answer
                    ? "bg-green-50 dark:bg-green-900/30"
                    : ""
                }
              `}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
