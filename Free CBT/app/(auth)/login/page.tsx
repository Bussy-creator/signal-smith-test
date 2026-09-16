"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Spinner from "@/components/Spinner";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  const callbackFailed = searchParams.get("error") === "auth-callback-failed";
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Students may type either their email or student ID in this field;
    // if it doesn't look like an email, resolve it to an email server-side
    // (kept simple here — production would add a lookup RPC).
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    // Show a full-screen loading state while the dashboard's server-side
    // data (profile, courses, attempts) loads, so the click never feels
    // like it did nothing.
    setRedirecting(true);
    router.push("/dashboard");
  }

  if (redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Spinner className="h-8 w-8 text-brand" />
        <p className="text-sm text-gray-500">Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-10 sm:mt-24 px-4">
      <a href="/"><img src="/logo.svg" alt="Free CBT" className="h-10 mb-6" /></a>
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      {justRegistered && (
        <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950/40 rounded px-3 py-2 mb-4">
          Account created — log in to continue.
        </p>
      )}
      {callbackFailed && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded px-3 py-2 mb-4">
          That link has expired or was already used. Request a new one from{" "}
          <a href="/forgot-password" className="underline">forgot password</a>.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email or Student ID</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end">
          <a href="/forgot-password" className="text-xs text-brand">Forgot password?</a>
        </div>
        <button
          disabled={loading}
          className="w-full py-2 rounded bg-brand text-white disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm mt-4 text-gray-500">
        No account? <a href="/register" className="text-brand">Register</a>
      </p>
    </div>
  );
}
