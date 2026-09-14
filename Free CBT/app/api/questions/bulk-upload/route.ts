import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import crypto from "crypto";
import { z } from "zod";
import { Redis } from "@upstash/redis";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/server";

// /api/quiz/start caches each course's full question pool in Redis for
// 30 min (key: qpool:<courseId>) so exam-start doesn't hammer Postgres
// when many students begin at once. That cache MUST be invalidated here
// whenever this route adds questions to a course — otherwise a course
// whose pool was already cached (even cached as empty, before any
// questions existed) won't show newly uploaded questions for up to 30
// minutes, and practice/exam start can come back with zero questions
// even though the topic picker (which reads Postgres directly) shows
// them as available.
const redis = Redis.fromEnv();

// Expected columns in the CSV/XLSX template:
// question_text, option_a, option_b, option_c, option_d, correct_answer,
// explanation, topic, and (optionally) course_code
// There is deliberately no `level` column: a question's level is the
// level of the course it belongs to (courses.level), which is already
// resolved from course_code below — asking for it twice invited
// mismatches like a row saying "level: Undergraduate" for a course
// that's actually 100-level in courses.level.
//
// course_code is only required in the CSV itself if the admin uploads
// without picking a course in the form (courseId form field) — see the
// fallback-fill logic in POST below. Most uploads are single-course, so
// the common case is: pick the course in the UI, omit the column.
//
// Whether `explanation` is required depends on requireExplanation,
// a per-upload toggle set by the admin (some source files just don't
// have explanations, and that's fine) — see buildRowSchema below.
function buildRowSchema(requireExplanation: boolean) {
  return z.object({
    question_text: z.string().min(5),
    option_a: z.string().min(1),
    option_b: z.string().min(1),
    option_c: z.string().min(1),
    option_d: z.string().min(1),
    correct_answer: z.enum(["A", "B", "C", "D", "a", "b", "c", "d"]),
    explanation: requireExplanation
      ? z.string().min(3, "explanation is required for this upload")
      : z.string().optional().default(""),
    topic: z.string().min(1),
    course_code: z.string().min(1)
  });
}

type ParsedRow = z.infer<ReturnType<typeof buildRowSchema>>;

interface RowError {
  row: number;
  errors: string[];
}

function parseFile(buffer: ArrayBuffer, filename: string): Record<string, unknown>[] {
  if (filename.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder().decode(buffer);
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_")
    });
    return result.data;
  }
  // .xlsx / .xls
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function normalizedHash(questionText: string): string {
  return crypto
    .createHash("sha256")
    .update(questionText.trim().toLowerCase().replace(/\s+/g, " "))
    .digest("hex");
}

/**
 * Two-phase upload:
 *  - mode=validate (default): parse + validate every row, return an error
 *    report and a preview. Nothing is written to the DB.
 *  - mode=commit: re-parses the same file and inserts only rows that pass
 *    validation, skipping duplicates already present for that course.
 * The admin UI calls validate first, shows the report, then calls commit
 * only after the admin confirms.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const mode = (formData.get("mode") as string) || "validate";
  const requireExplanation = formData.get("requireExplanation") === "true";
  const selectedCourseId = (formData.get("courseId") as string) || "";
  const RowSchema = buildRowSchema(requireExplanation);

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  let rawRows: Record<string, unknown>[];
  try {
    rawRows = parseFile(buffer, file.name);
  } catch (e) {
    return NextResponse.json({ error: "Could not parse file. Use CSV or XLSX." }, { status: 400 });
  }

  // If the admin picked a course in the upload form, use its code as the
  // fallback for any row that doesn't specify its own course_code — this
  // is what lets a single-course upload omit the course_code column
  // entirely. Rows that DO specify course_code keep using that instead,
  // so multi-course files and older CSVs with the column still work.
  if (selectedCourseId) {
    const supabaseEarly = createAdminClient();
    const { data: selectedCourse } = await supabaseEarly
      .from("courses")
      .select("code")
      .eq("id", selectedCourseId)
      .single();

    if (selectedCourse?.code) {
      rawRows = rawRows.map((raw) => {
        const existing = typeof raw.course_code === "string" ? raw.course_code.trim() : "";
        return existing ? raw : { ...raw, course_code: selectedCourse.code };
      });
    }
  }

  const validRows: ParsedRow[] = [];
  const rowErrors: RowError[] = [];

  rawRows.forEach((raw, idx) => {
    const result = RowSchema.safeParse(raw);
    if (!result.success) {
      rowErrors.push({
        row: idx + 2, // +1 for 0-index, +1 for header row
        errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      });
    } else {
      validRows.push(result.data);
    }
  });

  if (mode === "validate") {
    return NextResponse.json({
      totalRows: rawRows.length,
      validCount: validRows.length,
      invalidCount: rowErrors.length,
      errors: rowErrors,
      preview: validRows.slice(0, 5)
    });
  }

  // ---- commit phase ----
  // Batched deliberately: the old version did one "find-or-create topic"
  // query plus one insert PER ROW, sequentially awaited. For a file with
  // 1000+ rows that's 2000+ round trips to the DB in a single request,
  // which is what was blowing past the serverless function's execution
  // limit and coming back as a timeout (a non-JSON HTML error page,
  // hence the JSON.parse crash on the client). Everything below is
  // batched per course instead: a handful of queries no matter how many
  // rows are in the file.
  const supabase = createAdminClient();
  const insertedByCourse: Record<string, number> = {};
  const skipped: { row: number; reason: string }[] = [];
  const touchedCourseIds = new Set<string>();
  let inserted = 0;

  const CHUNK_SIZE = 500;
  function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // Group valid rows by course_code to resolve course_id/topic_ids once per group
  const byCourse = new Map<string, ParsedRow[]>();
  for (const row of validRows) {
    const key = row.course_code.trim().toUpperCase();
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key)!.push(row);
  }

  // Course codes are typed by hand ("PHY101" vs "PHY 101" vs "phy-101")
  // and a literal .ilike() match treats those as different courses even
  // though they're clearly meant to be the same one. Fetch every course
  // once and match by a whitespace/case-normalized key instead — this
  // also cuts the lookup from one query per course group down to one
  // query total.
  const normalize = (s: string) => s.replace(/[\s-]+/g, "").toUpperCase();
  const { data: allCourses, error: allCoursesErr } = await supabase.from("courses").select("id, code");
  const courseByNormalizedCode = new Map<string, { id: string; code: string }>();
  if (!allCoursesErr) {
    for (const c of allCourses ?? []) courseByNormalizedCode.set(normalize(c.code), c);
  }

  for (const [courseCode, rows] of byCourse) {
    const course = courseByNormalizedCode.get(normalize(courseCode));

    if (!course) {
      skipped.push({
        row: -1,
        reason: `Course "${courseCode}" not found — create it first, or check its code matches exactly (spacing/case are ignored, but the letters and numbers must match). (${rows.length} row(s) skipped.)`
      });
      continue;
    }
    touchedCourseIds.add(course.id);

    // Resolve every distinct topic name in this batch in ONE query, then
    // create only the ones that don't already exist in ONE insert —
    // instead of a select+maybe-insert per row.
    const { data: existingTopics, error: topicsFetchErr } = await supabase
      .from("topics")
      .select("id, name")
      .eq("course_id", course.id);

    if (topicsFetchErr) {
      skipped.push({ row: -1, reason: `Could not read topics for "${courseCode}": ${topicsFetchErr.message}` });
      continue;
    }

    const topicIdByName = new Map<string, string>();
    for (const t of existingTopics ?? []) topicIdByName.set(t.name.trim().toLowerCase(), t.id);

    const distinctTopicNames = Array.from(new Set(rows.map((r) => r.topic.trim())));
    const missingTopicNames = distinctTopicNames.filter((n) => !topicIdByName.has(n.toLowerCase()));

    if (missingTopicNames.length > 0) {
      const { data: createdTopics, error: topicCreateErr } = await supabase
        .from("topics")
        .insert(missingTopicNames.map((name) => ({ course_id: course.id, name })))
        .select("id, name");

      if (topicCreateErr) {
        skipped.push({ row: -1, reason: `Could not create topics for "${courseCode}": ${topicCreateErr.message}` });
        continue;
      }
      for (const t of createdTopics ?? []) topicIdByName.set(t.name.trim().toLowerCase(), t.id);
    }

    // Build the insert payload. Duplicate detection against existing
    // questions (and against repeats within this same file) is handled
    // below by upsert-with-ignoreDuplicates on (course_id, content_hash)
    // rather than a separate lookup query per row — Postgres's
    // ON CONFLICT DO NOTHING skips both cases in one pass.
    const toInsert: Record<string, unknown>[] = [];
    for (const row of rows) {
      const topicId = topicIdByName.get(row.topic.trim().toLowerCase());
      if (!topicId) {
        skipped.push({ row: -1, reason: `Could not resolve topic "${row.topic}" for "${courseCode}".` });
        continue;
      }
      toInsert.push({
        course_id: course.id,
        topic_id: topicId,
        question_text: row.question_text.trim(),
        option_a: row.option_a,
        option_b: row.option_b,
        option_c: row.option_c,
        option_d: row.option_d,
        correct_option: row.correct_answer.toUpperCase(),
        explanation: row.explanation,
        content_hash: normalizedHash(row.question_text),
        created_by: admin.userId
      });
    }

    for (const batch of chunk(toInsert, CHUNK_SIZE)) {
      const { data: insertedRows, error: insertErr } = await supabase
        .from("questions")
        .upsert(batch, { onConflict: "course_id,content_hash", ignoreDuplicates: true })
        .select("id");

      if (insertErr) {
        skipped.push({ row: -1, reason: `Batch insert failed for "${courseCode}" (${batch.length} rows): ${insertErr.message}` });
        continue;
      }
      const insertedCount = insertedRows?.length ?? 0;
      inserted += insertedCount;
      insertedByCourse[courseCode] = (insertedByCourse[courseCode] || 0) + insertedCount;
      const duplicateCount = batch.length - insertedCount;
      if (duplicateCount > 0) {
        skipped.push({
          row: -1,
          reason: `${duplicateCount} question(s) skipped for "${courseCode}" — already in the bank or repeated in this file.`
        });
      }
    }
  }

  // Invalidate the cached question pool for every course touched by this
  // upload, regardless of whether any rows were actually inserted (a run
  // that only added a new topic, or that's a no-op due to dedup, still
  // shouldn't leave a stale cache around) — see the comment at the top
  // of this file for why this step exists.
  await Promise.all([...touchedCourseIds].map((id) => redis.del(`qpool:${id}`)));

  await supabase.from("bulk_upload_jobs").insert({
    uploaded_by: admin.userId,
    filename: file.name,
    rows_total: rawRows.length,
    rows_inserted: inserted,
    rows_rejected: rowErrors.length + skipped.length,
    error_report: { rowErrors, skipped },
    status: "committed"
  });

  return NextResponse.json({
    inserted,
    insertedByCourse,
    skipped,
    validationErrors: rowErrors
  });
}
