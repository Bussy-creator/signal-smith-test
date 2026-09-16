import { Redis } from "@upstash/redis";

// Single shared client. Existing routes that instantiate their own
// Redis.fromEnv() still work fine (it's a stateless REST client, cheap to
// construct) — this export exists so lib/rate-limit.ts has one client to
// build its limiters against, rather than creating its own separately.
export const redis = Redis.fromEnv();
