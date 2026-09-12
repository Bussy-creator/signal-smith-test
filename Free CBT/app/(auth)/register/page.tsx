"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FACULTIES } from "@/lib/faculties";
import Spinner from "@/components/Spinner";
import SearchableSelect from "@/components/SearchableSelect";

const LEVELS = [100, 200, 300, 400, 500, 600];

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    facultyId: "",
    departmentCode: "",
    level: 100,
    studentId: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const selectedFaculty = useMemo(
    () => FACULTIES.find((f) => f.id === form.facultyId) ?? null,
    [form.facultyId]
  );

  function handleFacultyChange(facultyId: string) {
    // Changing faculty invalidates whatever department was previously
    // selected, since departments are scoped to a faculty.
    setForm((f) => ({ ...f, facultyId, departmentCode: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedFaculty) return setError("Please select your faculty.");
    const department = selectedFaculty.departments.find((d) => d.code === form.departmentCode);
    if (!department) return setError("Please select your department.");

    setLoading(true);

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password
    });
    if (signUpErr || !data.user) {
      setLoading(false);
      return setError(signUpErr?.message ?? "Sign up failed");
    }

    const { error: profileErr } = await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: form.fullName,
      student_id: form.studentId,
      phone: form.phone,
      faculty: selectedFaculty.name,
      department: department.name,
      level: form.level
    });

    setLoading(false);
    if (profileErr) return setError(profileErr.message);

    // Registration creates a live session via signUp(); sign back out so
    // the student lands on the login screen and logs in deliberately,
    // rather than being dropped straight into the dashboard.
    setRedirecting(true);
    await supabase.auth.signOut();
    router.push("/login?registered=1");
  }

  if (redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Spinner className="h-8 w-8 text-brand" />
        <p className="text-sm text-gray-500">Account created — taking you to login…</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-6 sm:mt-16 px-4 pb-10">
      <a href="/"><img src="/logo.svg" alt="Free CBT" className="h-10 mb-6" /></a>
      <h1 className="text-2xl font-semibold mb-6">Create your account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
          required
        />
        <input
          placeholder="Matric / Reg Number"
          value={form.studentId}
          onChange={(e) => set("studentId", e.target.value)}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
          required
        />
        <input
          type="tel"
          placeholder="Phone number"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
          required
        />

        <div>
          <label className="block text-xs text-gray-500 mb-1">Faculty</label>
          <SearchableSelect
            options={FACULTIES.map((f) => ({ value: f.id, label: f.name }))}
            value={form.facultyId}
            onChange={handleFacultyChange}
            placeholder="Type to search your faculty…"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Department</label>
          <SearchableSelect
            options={
              selectedFaculty?.departments.map((d) => ({ value: d.code, label: `${d.name} (${d.code})` })) ?? []
            }
            value={form.departmentCode}
            onChange={(v) => set("departmentCode", v)}
            placeholder={selectedFaculty ? "Type to search your department…" : "Select a faculty first"}
            disabled={!selectedFaculty}
            required
          />
        </div>

        <select
          value={form.level}
          onChange={(e) => set("level", Number(e.target.value))}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
          required
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l} Level</option>
          ))}
        </select>
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={loading} className="w-full py-2 rounded bg-brand text-white disabled:opacity-60">
          {loading ? "Creating account…" : "Register"}
        </button>
      </form>
      <p className="text-sm mt-4 text-gray-500">
        Already have an account? <a href="/login" className="text-brand">Log in</a>
      </p>
    </div>
  );
}
