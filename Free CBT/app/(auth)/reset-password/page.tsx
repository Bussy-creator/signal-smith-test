"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Spinner from "@/components/Spinner";

/**
 * Reached only via /auth/callback after a valid password-reset email link
 * exchanges its code for a session. If someone lands here without that
 * (bookmarked the URL, link already used, session expired), there's no
 * session to update — checkingSession below catches that and points them
 * back to requesting a fresh link, rather than showing a form that will
 * just fail confusingly on submit.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user);
      setCheckingSession(false);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      return setError("Passwords don't match.");
    }

    setLoading(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateErr) return setError(updateErr.message);

    setRedirecting(true);
    router.push("/dashboard");
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8 text-brand" />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="max-w-sm mx-auto mt-10 sm:mt-24 px-4">
        <a href="/"><img src="/logo.svg" alt="Free CBT" className="h-10 mb-6" /></a>
        <h1 className="text-2xl font-semibold mb-4">Link expired</h1>
        <p className="text-sm text-gray-500 mb-6">
          This reset link is invalid or has already been used. Request a new one below.
        </p>
        <a href="/forgot-password" className="text-sm text-brand">Request a new link</a>
      </div>
    );
  }

  if (redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Spinner className="h-8 w-8 text-brand" />
        <p className="text-sm text-gray-500">Password updated — taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-10 sm:mt-24 px-4">
      <a href="/"><img src="/logo.svg" alt="Free CBT" className="h-10 mb-6" /></a>
      <h1 className="text-2xl font-semibold mb-6">Set a new password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            required
            minLength={6}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={loading}
          className="w-full py-2 rounded bg-brand text-white disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
