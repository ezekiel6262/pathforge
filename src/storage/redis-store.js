import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { AppError } from "../lib/errors.js";

const EMPTY = Object.freeze({ projects: {}, reports: {}, validationRuns: {}, alertRules: {}, alertEvents: {} });
const RELEASE_LOCK = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class RedisStore {
  constructor(redis, key = "pathforge:state:v1") {
    this.redis = redis;
    this.key = key;
    this.lockKey = `${key}:lock`;
    this.queue = Promise.resolve();
  }

  static fromEnv(key) {
    return new RedisStore(new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN
    }), key);
  }

  async read() {
    try {
      const value = await this.redis.get(this.key);
      if (!value) return structuredClone(EMPTY);
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      return { ...structuredClone(EMPTY), ...parsed };
    } catch (error) {
      throw new AppError(500, "STORE_READ_FAILED", "Unable to read the Veyra data store.", { cause: error.message });
    }
  }

  async acquireLock(token) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const acquired = await this.redis.set(this.lockKey, token, { nx: true, px: 10_000 });
      if (acquired === "OK") return;
      await wait(40 + attempt * 10);
    }
    throw new AppError(503, "STORE_BUSY", "Veyra storage is busy. Retry the request.");
  }

  async transaction(mutator) {
    const operation = this.queue.then(async () => {
      const token = randomUUID();
      await this.acquireLock(token);
      try {
        const data = await this.read();
        const result = await mutator(data);
        await this.redis.set(this.key, data);
        return result;
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, "STORE_WRITE_FAILED", "Unable to write the Veyra data store.", { cause: error.message });
      } finally {
        await this.redis.eval(RELEASE_LOCK, [this.lockKey], [token]).catch(() => {});
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
