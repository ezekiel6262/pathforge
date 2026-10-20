import test from "node:test";
import assert from "node:assert/strict";
import { RedisStore } from "../src/storage/redis-store.js";

class FakeRedis {
  constructor() { this.values = new Map(); }
  async get(key) { return structuredClone(this.values.get(key)); }
  async set(key, value, options = {}) {
    if (options.nx && this.values.has(key)) return null;
    this.values.set(key, structuredClone(value));
    return "OK";
  }
  async eval(_script, keys, args) {
    if (this.values.get(keys[0]) === args[0]) return this.values.delete(keys[0]) ? 1 : 0;
    return 0;
  }
}

test("persists state through the Redis storage adapter", async () => {
  const redis = new FakeRedis();
  const first = new RedisStore(redis, "test:pathforge");
  await first.transaction((data) => { data.projects.alpha = { id: "alpha", name: "Alpha" }; });

  const second = new RedisStore(redis, "test:pathforge");
  const stored = await second.read();
  assert.equal(stored.projects.alpha.name, "Alpha");
  assert.equal(redis.values.has("test:pathforge:lock"), false);
});
