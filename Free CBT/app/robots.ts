import type { MetadataRoute } from "next";

// Same NEXT_PUBLIC_SITE_URL as app/layout.tsx — set per-environment in
// Vercel (Preview vs Production URLs differ).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything behind auth (dashboard, quiz, admin), the API, and
      // the transient auth-flow pages (reset-password only makes sense
      // mid-flow with a valid session — nothing there to index).
      disallow: ["/dashboard", "/quiz", "/admin", "/api", "/reset-password", "/auth"]
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
