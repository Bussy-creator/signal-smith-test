import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz",
  // Auth-gated and different per student/attempt — nothing here is
  // meaningfully indexable, and it's also disallowed in robots.ts.
  robots: { index: false, follow: false }
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
