import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/courses
 * body: { code, title, department, level, semester }
 *
 * Courses previously had no UI at all — an admin had to insert rows
 * directly in the Supabase Table Editor. This is the missing piece: the
 * bulk question-upload flow resolves questions against an EXISTING course
 * by code, so a course needs to exist before its questions can be
 * uploaded.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { code, title, department, level, semester } = await req.json();

  if (!code || !title || !department || !level || !semester) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (![100, 200, 300, 400, 500, 600].includes(Number(level))) {
    return NextResponse.json({ error: "Invalid level." }, { status: 400 });
  }
  if (![1, 2].includes(Number(semester))) {
    return NextResponse.json({ error: "Semester must be 1 or 2." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      code: String(code).trim().toUpperCase(),
      title: String(title).trim(),
      department: String(department).trim(),
      level: Number(level),
      semester: Number(semester)
    })
    .select()
    .single();

  if (error) {
    // Unique constraint on `code` is the most common failure here
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ course: data });
}

/**
 * GET /api/admin/courses — list all courses, for the admin dropdown used
 * when bulk-uploading questions or picking which course an ad targets.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, code, title, department, level, semester")
    .order("code");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ courses: data });
}

/**
 * PATCH /api/admin/courses
 * body: { id, code, title, department, level, semester }
 * Edits an existing course in place — fixes typos without touching the
 * Table Editor. Questions/topics/enrollments stay linked since they
 * reference the course by id, not by its code/title text.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id, code, title, department, level, semester } = await req.json();

  if (!id || !code || !title || !department || !level || !semester) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (![100, 200, 300, 400, 500, 600].includes(Number(level))) {
    return NextResponse.json({ error: "Invalid level." }, { status: 400 });
  }
  if (![1, 2].includes(Number(semester))) {
    return NextResponse.json({ error: "Semester must be 1 or 2." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .update({
      code: String(code).trim().toUpperCase(),
      title: String(title).trim(),
      department: String(department).trim(),
      level: Number(level),
      semester: Number(semester)
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ course: data });
}

/**
 * DELETE /api/admin/courses?id=<uuid>
 * Deletes a course. Topics and questions cascade-delete with it (they
 * reference courses(id) ON DELETE CASCADE). quiz_attempts does NOT
 * cascade — deleting a course students have already taken quizzes for
 * fails with a foreign-key violation, which is surfaced as a clear error
 * rather than silently orphaning or destroying student attempt history.
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "Can't delete — students have already taken quizzes for this course. Their attempt history has to stay linked to it."
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
