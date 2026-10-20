import test from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "../src/rate-limit.js";

test("blocks requests beyond a fixed-window limit", async () => {
  const limiter = new RateLimiter();
  await limiter.check("test", 2, 60);
  await limiter.check("test", 2, 60);
  await assert.rejects(() => limiter.check("test", 2, 60), (error) => error.status === 429 && error.code === "RATE_LIMITED");
});
