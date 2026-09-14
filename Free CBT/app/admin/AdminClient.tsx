"use client";

import { useEffect, useState } from "react";
import { FACULTIES } from "@/lib/faculties";
import Navbar from "@/components/Navbar";
import SearchableSelect from "@/components/SearchableSelect";

// Flattened, de-duplicated department names across all faculties — used
// so a course's `department` field matches exactly what's stored on
// student profiles (see /lib/faculties.ts), which is what the dashboard's
// "your courses this semester" query filters on.
const ALL_DEPARTMENTS = Array.from(
  new Set(FACULTIES.flatMap((f) => f.departments.map((d) => d.name)))
).sort();

const LEVELS = [100, 200, 300, 400, 500, 600];

export default function AdminClient({ fullName }: { fullName?: string | null }) {
  return (
    <div>
      <Navbar fullName={fullName} isAdmin />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-10 space-y-10">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <CourseManagerSection />
        <CourseHealthSection />
        <BulkUploadSection />
        <QuestionManagerSection />
        <AdManagerSection />
        <SiteSettingsSection />
        <SemesterResetSection />
      </div>
    </div>
  );
}

function CourseManagerSection() {
  const emptyForm = { id: "", code: "", title: "", department: "", level: 100, semester: 1 };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function loadCourses() {
    setLoadingCourses(true);
    const res = await fetch("/api/admin/courses");
    if (res.ok) {
      const data = await res.json();
      setCourses(data.courses ?? []);
    }
    setLoadingCourses(false);
  }

  useEffect(() => {
    loadCourses();
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(course: any) {
    setEditingId(course.id);
    setForm({
      id: course.id,
      code: course.code,
      title: course.title,
      department: course.department,
      level: course.level,
      semester: course.semester
    });
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
  }

  async function submit() {
    if (!form.code || !form.title || !form.department) {
      return setMessage({ text: "Course code, title, and department are required.", ok: false });
    }
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/admin/courses", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) return setMessage({ text: data.error ?? "Could not save course.", ok: false });
    setMessage({ text: `Course "${data.course.code}" ${editingId ? "updated" : "created"}.`, ok: true });
    setEditingId(null);
    setForm(emptyForm);
    loadCourses();
  }

  async function deleteCourse(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/admin/courses?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (!res.ok) {
      setMessage({ text: data.error ?? "Could not delete course.", ok: false });
      return;
    }
    loadCourses();
  }

  return (
    <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-medium mb-1">{editingId ? "Edit course" : "Create a course"}</h2>
      <p className="text-sm text-gray-500 mb-4">
        Courses must exist here before you can bulk-upload questions for them, or before
        students can select them each semester.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <input
          placeholder="Course code (e.g. MTS 101)"
          value={form.code}
          onChange={(e) => set("code", e.target.value)}
          className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
        />
        <input
          placeholder="Course title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
        />
        <SearchableSelect
          options={ALL_DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          value={form.department}
          onChange={(v) => set("department", v)}
          placeholder="Type to search department…"
        />
        <div className="flex gap-2">
          <select
            value={form.level}
            onChange={(e) => set("level", Number(e.target.value))}
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l} Level</option>
            ))}
          </select>
          <select
            value={form.semester}
            onChange={(e) => set("semester", Number(e.target.value))}
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
          >
            <option value={1}>1st Semester</option>
            <option value={2}>2nd Semester</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="px-4 py-2 rounded bg-brand text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : editingId ? "Save changes" : "Create course"}
        </button>
        {editingId && (
          <button onClick={cancelEdit} className="px-4 py-2 rounded border border-gray-300 dark:border-gray-700">
            Cancel
          </button>
        )}
      </div>
      {message && (
        <p className={`text-sm mt-3 ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>
      )}

      <h3 className="text-sm font-medium mt-6 mb-2">Existing courses</h3>
      {loadingCourses ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : courses.length === 0 ? (
        <p className="text-sm text-gray-400">No courses yet.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {courses.map((c) => (
            <div
              key={c.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-gray-200 dark:border-gray-800 rounded p-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{c.code} — {c.title}</div>
                <div className="text-gray-400 text-xs truncate">
                  {c.department} · {c.level}L · Semester {c.semester}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <button
                  onClick={() => startEdit(c)}
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
                >
                  Edit
                </button>
                {confirmDeleteId === c.id ? (
                  <>
                    <button
                      onClick={() => deleteCourse(c.id)}
                      disabled={deletingId === c.id}
                      className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-60"
                    >
                      {deletingId === c.id ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(c.id)}
                    className="text-xs px-2 py-1 rounded border border-red-400 text-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CourseHealthSection() {
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/courses/health");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not run the health check.");
        return;
      }
      setResults(data.courses);
    } catch {
      setError("Network error while running the health check.");
    } finally {
      setLoading(false);
    }
  }

  const statusStyles: Record<string, string> = {
    ok: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    warning: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    empty: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300",
    error: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300"
  };
  const statusLabel: Record<string, string> = {
    ok: "OK",
    warning: "Warning",
    empty: "Empty",
    error: "Error"
  };

  return (
    <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-medium mb-1">Course health check</h2>
      <p className="text-sm text-gray-500 mb-4">
        Checks every course at once: how many topics and questions it has, and flags anything with
        zero questions (practice/exam would come up empty) or topics with no questions in them.
        This also refreshes each course's cached question pool to match the database right now —
        useful as a manual fix if a course ever seems stuck showing stale/missing questions.
      </p>
      <button
        onClick={runCheck}
        disabled={loading}
        className="px-4 py-2 rounded bg-brand text-white text-sm disabled:opacity-60 mb-4"
      >
        {loading ? "Checking all courses…" : "Check all courses"}
      </button>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {results && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-gray-400">No courses exist yet.</p>
          ) : (
            results.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 border border-gray-200 dark:border-gray-800 rounded p-3 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{c.code}</span>{" "}
                  <span className="text-gray-500 truncate">{c.title}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{c.message}</p>
                </div>
                <span
                  className={`shrink-0 self-start sm:self-center text-xs px-2 py-1 rounded ${
                    statusStyles[c.status] ?? ""
                  }`}
                >
                  {statusLabel[c.status] ?? c.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

function BulkUploadSection() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [requireExplanation, setRequireExplanation] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses ?? []);
      }
    })();
  }, []);

  // Reads the response as JSON, but falls back to a readable message
  // instead of throwing if the server returned something else (an HTML
  // error page from a timeout/crash, for instance) — this is what was
  // leaving the button stuck disabled: res.json() throwing meant
  // setBusy(false) below never ran.
  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        error: `Server returned an unexpected (non-JSON) response, status ${res.status}. This usually means the request timed out — try again, or split a very large file into smaller batches.`
      };
    }
  }

  async function runUpload(mode: "validate" | "commit") {
    if (!file) return;
    setBusy(true);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      fd.append("requireExplanation", String(requireExplanation));
      if (courseId) fd.append("courseId", courseId);
      const res = await fetch("/api/questions/bulk-upload", { method: "POST", body: fd });
      setReport(await safeJson(res));
    } catch {
      setReport({ error: "Network error while uploading. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const validate = () => runUpload("validate");
  const commit = () => runUpload("commit");

  return (
    <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-medium mb-1">Bulk question upload</h2>
      <p className="text-sm text-gray-500 mb-4">
        CSV or XLSX with columns: question_text, option_a, option_b, option_c, option_d,
        correct_answer, explanation, topic. The course must already exist (create it above
        first) — its level is taken from the course record automatically. Pick the course below
        and your file doesn't need a course_code column at all; if you're uploading a
        multi-course file instead, leave the course unselected and include course_code per row
        as before.
      </p>
      <select
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm mb-3"
      >
        <option value="">No course selected — file must include course_code per row</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
        ))}
      </select>
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-3 text-sm"
      />
      <label className="flex items-center gap-2 mb-3 text-sm">
        <input
          type="checkbox"
          checked={requireExplanation}
          onChange={(e) => setRequireExplanation(e.target.checked)}
        />
        This file includes an explanation for every question (require the explanation column
        to be filled in)
      </label>
      <div className="flex gap-2 mb-4">
        <button
          onClick={validate}
          disabled={!file || busy}
          className="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50"
        >
          Validate
        </button>
        <button
          onClick={commit}
          disabled={!file || busy || !report || report.invalidCount > 0}
          className="px-4 py-2 rounded bg-brand text-white disabled:opacity-50"
        >
          Confirm & Upload
        </button>
      </div>

      {report && (
        <div className="text-sm bg-gray-50 dark:bg-gray-900 rounded p-3 space-y-1 max-h-64 overflow-y-auto">
          {report.error && <p className="text-red-500 font-medium">{report.error}</p>}
          {"validCount" in report && (
            <p>
              {report.validCount} valid / {report.invalidCount} invalid of {report.totalRows} rows.
            </p>
          )}
          {"inserted" in report && <p className="font-medium text-green-600">Inserted {report.inserted} questions.</p>}
          {report.skipped?.length > 0 && (
            <div className="pt-1">
              <p className="font-medium text-amber-600">{report.skipped.length} note(s) on skipped rows:</p>
              {report.skipped.map((s: any, i: number) => (
                <p key={i} className="text-amber-600">{s.reason}</p>
              ))}
            </div>
          )}
          {report.errors?.map((e: any, i: number) => (
            <p key={i} className="text-red-500">Row {e.row}: {e.errors.join("; ")}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function QuestionManagerSection() {
  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; attemptReferenceCount: number } | null>(null);
  const [checkingDelete, setCheckingDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [attemptCount, setAttemptCount] = useState(0);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses ?? []);
        if (data.courses?.length && !courseId) setCourseId(data.courses[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuestions() {
    if (!courseId) return;
    setLoading(true);
    const params = new URLSearchParams({ course_id: courseId, page: String(page) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/questions?${params}`);
    if (res.ok) {
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setTopics(data.topics ?? []);
      setTotal(data.total ?? 0);
      setAttemptCount(data.attemptCount ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, page, search]);

  function startEdit(q: any) {
    setEditingId(q.id);
    setEditForm({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      explanation: q.explanation ?? "",
      topic_id: q.topic_id
    });
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit() {
    if (!editingId || !editForm) return;
    setSaving(true);
    const res = await fetch(`/api/admin/questions/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm)
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setMessage({ text: data.error ?? "Could not save question.", ok: false });
    setMessage({ text: "Question updated.", ok: true });
    setEditingId(null);
    setEditForm(null);
    loadQuestions();
  }

  async function requestDelete(id: string) {
    setCheckingDelete(id);
    const res = await fetch(`/api/admin/questions/${id}`);
    const data = await res.json();
    setCheckingDelete(null);
    if (!res.ok) return setMessage({ text: data.error ?? "Could not check this question.", ok: false });
    setDeleteTarget({ id, attemptReferenceCount: data.attemptReferenceCount ?? 0 });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    const res = await fetch(`/api/admin/questions/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingId(null);
    setDeleteTarget(null);
    if (!res.ok) return setMessage({ text: data.error ?? "Could not delete question.", ok: false });
    setMessage({ text: "Question deleted.", ok: true });
    loadQuestions();
  }

  const selectedCourse = courses.find((c) => c.id === courseId);

  async function purgeCourse() {
    if (!selectedCourse) return;
    setPurging(true);
    const res = await fetch(`/api/admin/questions?course_id=${courseId}`, { method: "DELETE" });
    const data = await res.json();
    setPurging(false);
    setPurgeOpen(false);
    setPurgeConfirmText("");
    if (!res.ok) return setMessage({ text: data.error ?? "Could not purge questions.", ok: false });
    setMessage({ text: `Deleted all ${data.deletedCount} question(s) for ${selectedCourse.code}.`, ok: true });
    setPage(1);
    loadQuestions();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-medium mb-1">Manage questions</h2>
      <p className="text-sm text-gray-500 mb-4">
        Edit or delete individual questions already in the bank. Deleting a question never
        affects students' past attempts — each attempt keeps its own snapshot of the questions
        it used — but you'll be warned if a question has been used before, since it means real
        students have already seen it.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
          ))}
        </select>
        <div className="flex gap-2 flex-1">
          <input
            placeholder="Search question text…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setSearch(searchInput);
              }
            }}
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
          />
          <button
            onClick={() => {
              setPage(1);
              setSearch(searchInput);
            }}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 text-sm"
          >
            Search
          </button>
        </div>
      </div>

      {message && (
        <p className={`text-sm mb-3 ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-gray-400">No questions found for this course{search ? " matching your search" : ""}.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="border border-gray-200 dark:border-gray-800 rounded p-3 text-sm">
              {editingId === q.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editForm.question_text}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, question_text: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {([["A", "option_a"], ["B", "option_b"], ["C", "option_c"], ["D", "option_d"]] as [string, string][]).map(
                      ([label, key]) => (
                        <input
                          key={key}
                          value={editForm[key]}
                          onChange={(e) => setEditForm((f: any) => ({ ...f, [key]: e.target.value }))}
                          placeholder={`Option ${label}`}
                          className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
                        />
                      )
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={editForm.correct_option}
                      onChange={(e) => setEditForm((f: any) => ({ ...f, correct_option: e.target.value }))}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
                    >
                      {["A", "B", "C", "D"].map((o) => (
                        <option key={o} value={o}>Correct: {o}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.topic_id}
                      onChange={(e) => setEditForm((f: any) => ({ ...f, topic_id: e.target.value }))}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
                    >
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={editForm.explanation}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, explanation: e.target.value }))}
                    placeholder="Explanation (optional)"
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 rounded bg-brand text-white disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button onClick={cancelEdit} className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex-1">{q.question_text}</p>
                    <span className="shrink-0 text-xs text-gray-400">{q.topics?.name}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Correct: {q.correct_option}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => startEdit(q)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
                    >
                      Edit
                    </button>
                    {deleteTarget && deleteTarget.id === q.id ? (
                      <>
                        <span className="text-xs text-amber-600 self-center">
                          {deleteTarget.attemptReferenceCount > 0
                            ? `Used in ${deleteTarget.attemptReferenceCount} past attempt(s) — their records are unaffected, but delete anyway?`
                            : "Delete this question?"}
                        </span>
                        <button
                          onClick={confirmDelete}
                          disabled={deletingId === q.id}
                          className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-60"
                        >
                          {deletingId === q.id ? "Deleting…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(null)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => requestDelete(q.id)}
                        disabled={checkingDelete === q.id}
                        className="text-xs px-2 py-1 rounded border border-red-400 text-red-600 disabled:opacity-60"
                      >
                        {checkingDelete === q.id ? "Checking…" : "Delete"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center gap-3 mt-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-gray-400">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {selectedCourse && total > 0 && (
        <div className="mt-6 pt-5 border-t border-red-200 dark:border-red-900">
          <h3 className="text-sm font-medium text-red-600 mb-1">Danger zone</h3>
          <p className="text-xs text-gray-500 mb-3">
            Permanently deletes every question in {selectedCourse.code} ({total} total). Topics are
            kept, so a fresh bulk upload can reuse them. Past attempts keep their own snapshot and
            are unaffected{attemptCount > 0 ? ` — but ${attemptCount} attempt(s) exist for this course.` : "."}
          </p>
          {!purgeOpen ? (
            <button
              onClick={() => setPurgeOpen(true)}
              className="text-xs px-3 py-1.5 rounded border border-red-400 text-red-600"
            >
              Purge all questions for {selectedCourse.code}
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs text-gray-500">
                Type <span className="font-mono font-medium">{selectedCourse.code}</span> to confirm:
              </label>
              <input
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                className="w-full px-3 py-2 rounded border border-red-300 dark:border-red-800 bg-transparent text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={purgeCourse}
                  disabled={
                    purging ||
                    purgeConfirmText.trim().toUpperCase() !== selectedCourse.code.trim().toUpperCase()
                  }
                  className="text-xs px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
                >
                  {purging ? "Purging…" : `Permanently delete all ${total} question(s)`}
                </button>
                <button
                  onClick={() => {
                    setPurgeOpen(false);
                    setPurgeConfirmText("");
                  }}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AdManagerSection() {
  const [sponsorName, setSponsorName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [flyerUrl, setFlyerUrl] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [placement, setPlacement] = useState("watermark");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [ads, setAds] = useState<any[]>([]);
  const [loadingAds, setLoadingAds] = useState(true);

  async function loadAds() {
    setLoadingAds(true);
    const res = await fetch("/api/admin/ads");
    if (res.ok) {
      const data = await res.json();
      setAds(data.ads ?? []);
    }
    setLoadingAds(false);
  }

  useEffect(() => {
    loadAds();
  }, []);

  async function save() {
    if (!sponsorName || (!imageFile && !flyerUrl)) {
      return setMessage({ text: "Sponsor name and either an image upload or a flyer URL are required.", ok: false });
    }
    setSaving(true);
    setMessage(null);

    const fd = new FormData();
    fd.append("sponsor_name", sponsorName);
    fd.append("placement", placement);
    if (targetLink) fd.append("target_link", targetLink);
    if (imageFile) fd.append("file", imageFile);
    else fd.append("flyer_image_url", flyerUrl);

    const res = await fetch("/api/admin/ads", { method: "POST", body: fd });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) return setMessage({ text: data.error ?? "Could not create ad.", ok: false });
    setMessage({ text: "Ad created.", ok: true });
    setSponsorName("");
    setImageFile(null);
    setFlyerUrl("");
    setTargetLink("");
    loadAds();
  }

  async function toggleActive(id: string, next: boolean) {
    await fetch("/api/admin/ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: next })
    });
    loadAds();
  }

  return (
    <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-medium mb-1">Ad manager</h2>
      <p className="text-sm text-gray-500 mb-4">
        Upload a flyer image directly (recommended), or paste an existing image URL. Choose where
        it appears and toggle it on/off any time below.
      </p>
      <div className="space-y-3 mb-6">
        <input
          placeholder="Sponsor name"
          value={sponsorName}
          onChange={(e) => setSponsorName(e.target.value)}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
        />

        <div>
          <label className="block text-xs text-gray-500 mb-1">Flyer image</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              setImageFile(e.target.files?.[0] ?? null);
              if (e.target.files?.[0]) setFlyerUrl("");
            }}
            className="text-sm mb-2"
          />
          <input
            placeholder="…or paste an image URL instead"
            value={flyerUrl}
            onChange={(e) => {
              setFlyerUrl(e.target.value);
              if (e.target.value) setImageFile(null);
            }}
            disabled={!!imageFile}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm disabled:opacity-50"
          />
        </div>

        <input
          placeholder="Target link (optional)"
          value={targetLink}
          onChange={(e) => setTargetLink(e.target.value)}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
        />
        <select
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
        >
          <option value="watermark">Background watermark (during quiz)</option>
          <option value="result_banner">Result screen banner</option>
          <option value="dashboard">Dashboard</option>
        </select>
        <p className="text-xs text-gray-400">
          Recommended size:{" "}
          {placement === "watermark"
            ? "1000×1000px square (PNG/WEBP, transparent OK, <300KB)"
            : placement === "result_banner"
            ? "1200×480px landscape (2.5:1, <400KB)"
            : "1200×600px landscape (2:1, <400KB)"}
          . Center important content — edges may get cropped.
        </p>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-brand text-white disabled:opacity-60">
          {saving ? "Uploading…" : "Create ad"}
        </button>
        {message && (
          <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>
        )}
      </div>

      <h3 className="text-sm font-medium mb-2">Existing ads</h3>
      {loadingAds ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : ads.length === 0 ? (
        <p className="text-sm text-gray-400">No ads yet.</p>
      ) : (
        <div className="space-y-2">
          {ads.map((ad) => (
            <div
              key={ad.id}
              className="flex items-center gap-3 border border-gray-200 dark:border-gray-800 rounded p-2"
            >
              <img
                src={ad.flyer_image_url}
                alt={ad.sponsor_name}
                className="w-12 h-12 object-cover rounded shrink-0"
              />
              <div className="flex-1 min-w-0 text-sm">
                <div className="font-medium truncate">{ad.sponsor_name}</div>
                <div className="text-gray-400 text-xs">{ad.placement}</div>
              </div>
              <button
                onClick={() => toggleActive(ad.id, !ad.is_active)}
                className={`text-xs px-2 py-1 rounded border shrink-0 ${
                  ad.is_active
                    ? "border-green-400 text-green-600"
                    : "border-gray-300 text-gray-400"
                }`}
              >
                {ad.is_active ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SiteSettingsSection() {
  const [supportPhone, setSupportPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const data = await res.json();
      const phone = data.settings?.find((s: any) => s.key === "support_phone");
      setSupportPhone(phone?.value ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "support_phone", value: supportPhone })
    });
    setSaving(false);
    setMessage(res.ok ? { text: "Saved.", ok: true } : { text: "Could not save.", ok: false });
  }

  return (
    <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
      <h2 className="text-lg font-medium mb-1">Site settings</h2>
      <p className="text-sm text-gray-500 mb-4">
        Shown to students on the "can't find your course?" prompt when choosing courses for the
        semester.
      </p>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="flex gap-2">
          <input
            placeholder="Support phone number (e.g. +234 801 234 5678)"
            value={supportPhone}
            onChange={(e) => setSupportPhone(e.target.value)}
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
          />
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-brand text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {message && (
        <p className={`text-sm mt-2 ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>
      )}
    </section>
  );
}

function SemesterResetSection() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    const res = await fetch("/api/admin/reset-semester", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setConfirming(false);
    setMessage(data.message ?? data.error);
  }

  return (
    <section className="border border-red-200 dark:border-red-900 rounded-lg p-5">
      <h2 className="text-lg font-medium mb-1 text-red-600">Semester reset</h2>
      <p className="text-sm text-gray-500 mb-4">
        Click this once at the start of each new semester. It clears every student's "courses
        this semester" selection (history and past scores are kept) so they're prompted to
        choose again on next login.
      </p>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="px-4 py-2 rounded border border-red-400 text-red-600">
          Reset semester enrollment
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={reset} disabled={busy} className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60">
            {busy ? "Resetting…" : "Yes, reset for everyone"}
          </button>
          <button onClick={() => setConfirming(false)} className="px-4 py-2 rounded border border-gray-300">
            Cancel
          </button>
        </div>
      )}
      {message && <p className="text-sm mt-3">{message}</p>}
    </section>
  );
}
