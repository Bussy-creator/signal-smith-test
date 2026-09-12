"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Spinner from "./Spinner";

interface Course {
  id: string;
  code: string;
  title: string;
}

/**
 * Shown on login whenever the student has no active
 * user_course_enrollment rows for the current semester (new student, or
 * the admin ran the semester-reset action) — AND reusable any other time
 * via the dashboard's "Manage courses" button, in which case
 * `initialSelectedIds` seeds the checklist with what's already enrolled
 * so the student can add or remove courses without losing their existing
 * picks.
 *
 * IMPORTANT: this must never be a dead end. If no courses exist yet for
 * the student's level (e.g. the admin hasn't uploaded any), `allCourses`
 * is empty — Continue is always clickable regardless; picking zero
 * courses just means "nothing enrolled," not a broken state.
 */
export default function SemesterCourseModal({
  allCourses,
  initialSelectedIds = [],
  onDone
}: {
  allCourses: Course[];
  initialSelectedIds?: string[];
  onDone: () => void;
}) {
  const supabase = createClient();
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [supportPhone, setSupportPhone] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "support_phone")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setSupportPhone(data.value);
      });
  }, []);

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCourses;
    return allCourses.filter(
      (c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    );
  }, [allCourses, search]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function save() {
    setSaving(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      // Newly checked or re-checked courses → active.
      if (selected.length > 0) {
        await supabase.from("user_course_enrollment").upsert(
          selected.map((courseId) => ({ user_id: user.id, course_id: courseId, is_active: true })),
          { onConflict: "user_id,course_id" }
        );
      }
      // Courses that WERE active but got unchecked this session → deactivate.
      // This is what actually makes "remove a course" work — upserting
      // only the checked set, with no deactivation step, would leave
      // unchecked-but-previously-active courses stuck active forever.
      const toRemove = initialSelectedIds.filter((id) => !selected.includes(id));
      if (toRemove.length > 0) {
        await supabase
          .from("user_course_enrollment")
          .update({ is_active: false })
          .eq("user_id", user.id)
          .in("course_id", toRemove);
      }
    }

    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
        <h2 className="text-lg font-semibold mb-2">What courses are you offering this semester?</h2>
        <p className="text-sm text-gray-500 mb-4">
          Select every course you're taking. Check to add, uncheck to remove — you can come back
          and change this any time from your dashboard.
        </p>

        {allCourses.length === 0 ? (
          <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/40 rounded px-3 py-2 mb-4">
            No courses have been added for your level yet. You can continue for now — once your
            admin uploads courses, come back here to select them.
          </p>
        ) : (
          <>
            <input
              placeholder="Search courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full mb-3 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
            />
            <div className="max-h-64 overflow-y-auto space-y-2 mb-2">
              {filteredCourses.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No courses match "{search}".</p>
              ) : (
                filteredCourses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                    {c.code} — {c.title}
                  </label>
                ))
              )}
            </div>
          </>
        )}

        {supportPhone && (
          <p className="text-xs text-gray-400 mb-4">
            Can't find your course? Send us a message at{" "}
            <span className="font-medium text-gray-600 dark:text-gray-300">{supportPhone}</span>.
          </p>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 rounded bg-brand text-white disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <Spinner className="h-4 w-4" />}
          {saving ? "Saving…" : allCourses.length === 0 ? "Continue" : selected.length === 0 ? "Save (no courses)" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
