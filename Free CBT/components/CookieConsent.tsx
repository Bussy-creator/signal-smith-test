"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "freecbt:cookie-consent";

/**
 * Free CBT only sets strictly-necessary cookies today (the Supabase auth
 * session cookie, via @supabase/ssr) — no analytics or ad-tracking
 * cookies. That's why this is a plain notice with a single "Got it"
 * rather than a granular accept/reject-by-category picker: there's
 * nothing optional to opt out of yet. If analytics or ad-tracking
 * cookies are ever added, this should be upgraded to let visitors
 * actually decline those specific categories.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consented = window.localStorage.getItem(STORAGE_KEY);
    if (!consented) setVisible(true);
  }, []);

  function accept() {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 flex-1">
          We use strictly necessary cookies to keep you logged in and remember your preferences.
          We don&apos;t use tracking or advertising cookies. By continuing to use Free CBT, you
          agree to this.
        </p>
        <button
          onClick={accept}
          className="w-full sm:w-auto shrink-0 px-4 py-2 rounded bg-brand text-white text-sm"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
