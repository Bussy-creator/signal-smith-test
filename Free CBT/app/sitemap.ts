import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Deliberately just the public, unauthenticated pages — dashboard, quiz,
// and admin routes require a login and have nothing for a crawler to
// usefully index (see robots.ts, which disallows them outright).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.8 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/forgot-password`, lastModified: now, changeFrequency: "yearly", priority: 0.2 }
  ];
}
