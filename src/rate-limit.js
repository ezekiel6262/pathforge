import { Redis } from "@upstash/redis";
import { AppError } from "./lib/errors.js";

export class RateLimiter {
  constructor(redis = null) { this.redis = redis; this.memory = new Map(); }
  static fromEnv() {
    const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }) : null;
    return new RateLimiter(redis);
  }
  async check(bucket, limit, windowSeconds) {
    let count;
    if (this.redis) {
      const key = `pathforge:rate:${bucket}`;
      count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, windowSeconds);
    } else {
      const now = Date.now();
      const current = this.memory.get(bucket);
      const next = !current || current.expiresAt <= now ? { count: 1, expiresAt: now + windowSeconds * 1000 } : { ...current, count: current.count + 1 };
      this.memory.set(bucket, next);
      count = next.count;
    }
    if (count > limit) throw new AppError(429, "RATE_LIMITED", "Too many requests. Please retry shortly.", { limit, windowSeconds });
  }
}
