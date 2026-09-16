import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  // Auth-gated and personalized per student — nothing to index, also
  // disallowed in robots.ts.
  robots: { index: false, follow: false }
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const { data: activeEnrollment } = await supabase
    .from("user_course_enrollment")
    .select("course_id, courses(id, code, title)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  // Courses are shown across every department (admins can only realistically
  // upload what they have resources for, and general courses span
  // departments anyway) but restricted to the student's own level — a
  // 100L student should never be able to enroll in "MTS 202" (a 200L
  // course). Course codes encode this via the `level` column set at
  // creation (200-series code → level 200, etc.), so this is a simple
  // equality filter rather than string-parsing the code.
  const { data: allCourses } = await supabase
    .from("courses")
    .select("id, code, title, department, level")
    .eq("level", profile?.level)
    .order("code");

  // Past attempts, most recent first — drives "highest score" and "needs work" lists
  const { data: attemptsRaw } = await supabase
    .from("quiz_attempts")
    .select("course_id, score, topic_breakdown, courses(code, title)")
    .eq("user_id", user.id)
    .not("score", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(50);

  // supabase-js can't infer join cardinality from the select string alone
  // (no generated Database types here), so it types `courses` as an array
  // even though course_id → courses is many-to-one and it's always a
  // single row at runtime. Normalize explicitly rather than casting, so
  // this stays correct even if that ever weren't true.
  const attempts = (attemptsRaw ?? []).map((a: NonNullable<typeof attemptsRaw>[number]) => ({
    ...a,
    courses: Array.isArray(a.courses) ? (a.courses[0] ?? null) : a.courses
  }));

  return (
    <DashboardClient
      profile={profile}
      activeEnrollment={activeEnrollment ?? []}
      allCourses={allCourses ?? []}
      attempts={attempts}
    />
  );
}
