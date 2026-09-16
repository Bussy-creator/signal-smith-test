import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set a new password",
  // Only ever reached mid-flow via a one-time email link with a live
  // session — nothing here is meaningfully indexable, and it shouldn't
  // show up in search results pointing people at a page that's a dead
  // end without that session.
  robots: { index: false, follow: false }
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
