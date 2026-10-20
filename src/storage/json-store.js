import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../lib/errors.js";

const EMPTY = Object.freeze({ projects: {}, reports: {}, validationRuns: {}, alertRules: {}, alertEvents: {} });

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async read() {
    try {
      const value = JSON.parse(await readFile(this.filePath, "utf8"));
      return { ...structuredClone(EMPTY), ...value };
    } catch (error) {
      if (error.code === "ENOENT") return structuredClone(EMPTY);
      throw new AppError(500, "STORE_READ_FAILED", "Unable to read the PathForge data store.", { cause: error.message });
    }
  }

  async transaction(mutator) {
    const operation = this.queue.then(async () => {
      const data = await this.read();
      const result = await mutator(data);
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      await rename(tempPath, this.filePath);
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
