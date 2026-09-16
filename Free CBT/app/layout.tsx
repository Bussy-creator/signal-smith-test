import type { Metadata } from "next";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";

// Set NEXT_PUBLIC_SITE_URL in Vercel's environment variables (Preview and
// Production separately, since the values differ) — this feeds
// metadataBase below, which every relative URL in this file's metadata
// (and the auto-generated OG/Twitter image from opengraph-image.tsx)
// resolves against. Falls back to localhost so `next dev`/local builds
// don't need it set.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Free CBT — Practice & Exam Simulation";
const description =
  "Computer-Based Testing platform for university students — practice quizzes and full exam simulations for your courses, built for exam-week traffic, without the lag.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | Free CBT"
  },
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Free CBT",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title,
    description
  },
  robots: {
    index: true,
    follow: true
  }
  // icons and the OG/Twitter image are picked up automatically from
  // app/icon.svg and app/opengraph-image.tsx via Next's file conventions
  // — no need to reference them here.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 min-h-screen">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
