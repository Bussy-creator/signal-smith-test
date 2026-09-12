"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SemesterCourseModal from "@/components/SemesterCourseModal";
import Navbar from "@/components/Navbar";
import DashboardAdCarousel from "@/components/DashboardAdCarousel";

interface Attempt {
  course_id: string;
  score: number;
  topic_breakdown: Record<string, { correct: number; total: number }> | null;
  courses: { code: string; title: string } | null;
}

export default function DashboardClient({
  profile,
  activeEnrollment,
  allCourses,
  attempts
}: {
  profile: any;
  activeEnrollment: any[];
  allCourses: any[];
  attempts: Attempt[];
}) {
  const router = useRouter();
  const [showCourseModal, setShowCourseModal] = useState(activeEnrollment.length === 0);

  // Best-performing and weakest courses, derived from attempt history —
  // simple aggregate, no ML needed for the MVP (see README roadmap).
  const { bestCourses, weakCourses } = useMemo(() => {
    const byCourse = new Map<string, { code: string; title: string; scores: number[] }>();
    for (const a of attempts) {
      if (!a.courses) continue;
      const key = a.course_id;
      if (!byCourse.has(key)) byCourse.set(key, { code: a.courses.code, title: a.courses.title, scores: [] });
      byCourse.get(key)!.scores.push(a.score);
    }
    const avg = [...byCourse.entries()].map(([id, v]) => ({
      id,
      code: v.code,
      title: v.title,
      avgScore: v.scores.reduce((s, x) => s + x, 0) / v.scores.length
    }));
    return {
      bestCourses: [...avg].sort((a, b) => b.avgScore - a.avgScore).slice(0, 3),
      weakCourses: [...avg].sort((a, b) => a.avgScore - b.avgScore).slice(0, 3)
    };
  }, [attempts]);

  const enrolledCourses = activeEnrollment.map((e) => e.courses).filter(Boolean);
  const hasAnyAttempts = attempts.length > 0;

  function handleModalDone() {
    setShowCourseModal(false);
    // Re-fetch the server-rendered enrollment/course data so "Your courses
    // this semester" reflects adds/removes immediately.
    router.refresh();
  }

  return (
    <div>
      <Navbar fullName={profile?.full_name} isAdmin={!!profile?.is_admin} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-10">
        {showCourseModal && (
          <SemesterCourseModal
            allCourses={allCourses}
            initialSelectedIds={enrolledCourses.map((c: any) => c.id)}
            onDone={handleModalDone}
          />
        )}

        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Welcome back, {profile?.full_name?.split(" ")[0]}</h1>
          <p className="text-sm text-gray-500">
            {profile?.department} · {profile?.level} Level
          </p>
        </div>

        <DashboardAdCarousel />

        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Your courses this semester</h2>
            <button
              onClick={() => setShowCourseModal(true)}
              className="text-xs sm:text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700"
            >
              Manage courses
            </button>
          </div>
          {enrolledCourses.length === 0 ? (
            <div className="p-4 rounded border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500">
              You haven't selected any courses yet.{" "}
              <button
                onClick={() => setShowCourseModal(true)}
                className="text-brand underline underline-offset-2"
              >
                Choose your courses for this semester
              </button>{" "}
              to start practicing.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {enrolledCourses.map((c: any) => (
                <div
                  key={c.id}
                  className="p-4 rounded border border-gray-200 dark:border-gray-800 hover:border-brand"
                >
                  <div className="font-medium mb-2">{c.code}</div>
                  <div className="text-sm text-gray-500 mb-3">{c.title}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/quiz/${c.id}/practice`)}
                      className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700"
                    >
                      Practice
                    </button>
                    <button
                      onClick={() => router.push(`/quiz/${c.id}/exam`)}
                      className="text-xs px-3 py-1.5 rounded bg-brand text-white"
                    >
                      Exam simulation
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {!hasAnyAttempts ? (
          <section className="p-5 rounded border border-dashed border-gray-300 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500">
              Take your first practice quiz or exam simulation to see personalized recommendations
              — your strongest topics and the ones to work on — show up here.
            </p>
          </section>
        ) : (
          <>
            {weakCourses.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-medium mb-3">Courses to work on</h2>
                <div className="space-y-2">
                  {weakCourses.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
                      <span>{c.code} — {c.title}</span>
                      <span className="text-sm font-medium">{c.avgScore.toFixed(0)}% avg</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {bestCourses.length > 0 && (
              <section>
                <h2 className="text-lg font-medium mb-3">Your strongest courses</h2>
                <div className="space-y-2">
                  {bestCourses.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30">
                      <span>{c.code} — {c.title}</span>
                      <span className="text-sm font-medium">{c.avgScore.toFixed(0)}% avg</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
