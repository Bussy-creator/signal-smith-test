"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  fullName?: string | null;
  isAdmin?: boolean;
}

export default function Navbar({ fullName, isAdmin }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [dark, setDark] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("freecbt:theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = stored ? stored === "dark" : prefersDark;
    setDark(shouldBeDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("freecbt:theme", next ? "dark" : "light");
  }

  async function logout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Deliberately tiny at the base (phones — this app is mobile-first) and
  // roomier from `sm:` up. At ~360px wide, logo + Dashboard + Admin +
  // theme toggle + Log out all fit on one line only if every element is
  // this compact; anything bigger here causes horizontal overflow on
  // small Android/iPhone SE widths.
  const linkClass = (href: string) =>
    `text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded whitespace-nowrap ${
      pathname?.startsWith(href)
        ? "bg-brand-light text-brand dark:bg-brand-dark/40 dark:text-white font-medium"
        : "text-gray-600 dark:text-gray-300 hover:text-brand"
    }`;

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 mb-4 sm:mb-6">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-1">
        <a href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.svg" alt="Free CBT" className="h-5 sm:h-7" />
        </a>

        <div className="flex items-center gap-0.5 sm:gap-2 min-w-0">
          <a href="/dashboard" className={linkClass("/dashboard")}>
            Dashboard
          </a>
          {isAdmin && (
            <a href="/admin" className={linkClass("/admin")}>
              Admin
            </a>
          )}

          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
            className="text-sm px-1.5 sm:px-2 py-1.5 rounded text-gray-500 hover:text-brand shrink-0"
          >
            {dark ? "☀️" : "🌙"}
          </button>

          {fullName && (
            <span className="hidden md:inline text-sm text-gray-400 px-1 truncate max-w-[100px]">
              {fullName.split(" ")[0]}
            </span>
          )}

          <button
            onClick={logout}
            disabled={loggingOut}
            className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {loggingOut ? "…" : "Log out"}
          </button>
        </div>
      </div>
    </nav>
  );
}
