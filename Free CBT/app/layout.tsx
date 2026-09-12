import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Free CBT — Practice & Exam Simulation",
  description: "Computer-Based Testing platform for university students."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
