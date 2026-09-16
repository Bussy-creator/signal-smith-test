import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createClient } from "@/lib/supabase/server";
import { publicReadLimiter, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const redis = Redis.fromEnv();
const CACHE_TTL_SECONDS = 60;

/**
 * GET /api/ads/active?placement=watermark|result_banner|dashboard
 *
 * Every quiz session and every result screen calls this — at 8,000
 * concurrent students that's a very hot path, so it's cached in Redis for
 * 60s per placement. A cache miss costs one indexed Postgres query; every
 * other request in that 60s window is served from Redis.
 */
export async function GET(req: NextRequest) {
  // No auth on this route (ad content isn't sensitive), so this is
  // IP-keyed rather than user-keyed — same generosity reasoning as
  // ipFloodLimiter re: shared campus NAT applies here too.
  const { success, reset } = await publicReadLimiter.limit(getClientIp(req));
  if (!success) return rateLimitedResponse(reset);

  const placement = req.nextUrl.searchParams.get("placement");
  if (!placement || !["watermark", "result_banner", "dashboard"].includes(placement)) {
    return NextResponse.json({ error: "Invalid placement" }, { status: 400 });
  }

  const cacheKey = `ads:active:${placement}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json({ ads: cached, cached: true });
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data: ads, error } = await supabase
    .from("advertisements")
    .select("id, sponsor_name, flyer_image_url, target_link, placement")
    .eq("placement", placement)
    .eq("is_active", true)
    .lte("start_at", nowIso)
    .or(`end_at.is.null,end_at.gte.${nowIso}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await redis.set(cacheKey, ads, { ex: CACHE_TTL_SECONDS });
  return NextResponse.json({ ads, cached: false });
}
