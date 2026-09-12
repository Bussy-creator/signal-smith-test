import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = createClient();
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
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("course_id, score, topic_breakdown, courses(code, title)")
    .eq("user_id", user.id)
    .not("score", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(50);

  return (
    <DashboardClient
      profile={profile}
      activeEnrollment={activeEnrollment ?? []}
      allCourses={allCourses ?? []}
      attempts={attempts ?? []}
    />
  );
}
