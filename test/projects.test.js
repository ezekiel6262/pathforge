import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { JsonStore } from "../src/storage/json-store.js";
import { ProjectService } from "../src/services/projects.js";
import { AlertService } from "../src/services/alerts.js";

test("persists projects and evaluates alert rules", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pathforge-test-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(path.join(directory, "store.json"));
  const projects = new ProjectService(store);
  const alerts = new AlertService(store);
  const project = await projects.create({ name: "ABC Token", tokenAddress: "0x1111111111111111111111111111111111111111" });
  await alerts.create(project.id, { name: "Link complete", field: "hypercore.linked", operator: "eq", value: true });
  const evaluation = await alerts.evaluate(project.id, { hypercore: { linked: true } });
  assert.equal((await projects.get(project.id)).name, "ABC Token");
  assert.equal(evaluation.triggered, 1);
});
