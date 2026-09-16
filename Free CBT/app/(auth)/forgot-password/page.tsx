"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Spinner from "@/components/Spinner";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
    });

    setLoading(false);

    // Supabase itself doesn't reveal whether the email exists, and neither
    // should this UI — always show the same confirmation, even if resetErr
    // is set for a reason unrelated to the email being wrong (e.g. rate
    // limiting), to avoid leaking which accounts are registered.
    if (resetErr && resetErr.status !== 400) {
      return setError(resetErr.message);
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto mt-10 sm:mt-24 px-4">
        <a href="/"><img src="/logo.svg" alt="Free CBT" className="h-10 mb-6" /></a>
        <h1 className="text-2xl font-semibold mb-4">Check your email</h1>
        <p className="text-sm text-gray-500 mb-6">
          If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a
          link to reset your password. It may take a minute to arrive — check spam too.
        </p>
        <a href="/login" className="text-sm text-brand">Back to log in</a>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-10 sm:mt-24 px-4">
      <a href="/"><img src="/logo.svg" alt="Free CBT" className="h-10 mb-6" /></a>
      <h1 className="text-2xl font-semibold mb-2">Reset your password</h1>
      <p className="text-sm text-gray-500 mb-6">
        Enter the email you registered with and we&apos;ll send you a reset link.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={loading}
          className="w-full py-2 rounded bg-brand text-white disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="text-sm mt-4 text-gray-500">
        Remembered it? <a href="/login" className="text-brand">Log in</a>
      </p>
    </div>
  );
}
