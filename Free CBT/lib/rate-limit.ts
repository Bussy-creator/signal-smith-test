import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { redis } from "@/lib/redis";

/**
 * Two layers, by design — see middleware.ts and each route for where
 * these are actually applied:
 *
 * 1. ipFloodLimiter (applied in middleware.ts to every /api/* request):
 *    a generous ceiling whose only job is stopping a raw flood from one
 *    source — a script or botnet hammering the API. It is deliberately
 *    NOT tuned to police normal usage: many FUTA students share a single
 *    public IP behind campus/hostel NAT, and a synchronized exam start is
 *    exactly the traffic spike this app needs to survive, not throttle.
 *    If this ever fires against real students, the fix is to raise the
 *    number, not to leave it as-is.
 *
 * 2. Per-route, per-user limiters below: applied inside each route AFTER
 *    auth resolves a real user id, so they're precise regardless of how
 *    many people share an IP. This is where actual abuse — a single
 *    compromised or scripted account hammering one endpoint — gets
 *    caught. Numbers are set well above any plausible legitimate use,
 *    not tuned tight.
 */

export const ipFloodLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(400, "60 s"),
  prefix: "rl:ip"
});

// A real student starts an exam once, maybe retries after a network
// hiccup — never more than a handful of times a minute.
export const quizStartLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6, "60 s"),
  prefix: "rl:quiz-start"
});

export const quizSubmitLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6, "60 s"),
  prefix: "rl:quiz-submit"
});

// Practice mode calls this once per question answered — a 30-question
// practice run firing quickly is normal, so this stays generous.
export const checkAnswerLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(90, "60 s"),
  prefix: "rl:check-answer"
});

// Bulk upload is expensive (parses a whole file, batches DB writes) —
// an admin doing this repeatedly in a short window is unusual.
export const bulkUploadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "5 m"),
  prefix: "rl:bulk-upload"
});

// Covers every other admin route (ads, courses, questions, settings,
// reset-semester) — generous enough for a human clicking around the
// admin panel, but stops a scripted hammer against any of them.
export const adminWriteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  prefix: "rl:admin"
});

// The two hot, Redis-cached public read paths (ads/active, course
// topics). Loose window since these are cheap and called on every page
// load — this exists to stop a scraping/flood pattern, not real usage.
export const publicReadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "10 s"),
  prefix: "rl:public-read"
});

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitedResponse(reset: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
