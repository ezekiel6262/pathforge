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

test("scopes wallet-owned projects while keeping public demos readable", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pathforge-ownership-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const projects = new ProjectService(new JsonStore(path.join(directory, "store.json")));
  const owner = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const stranger = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const owned = await projects.create({ name: "Owned", tokenAddress: "0x1111111111111111111111111111111111111111" }, owner);
  await projects.create({ name: "Public Demo", tokenAddress: "0x2222222222222222222222222222222222222222" });
  assert.equal((await projects.list(owner)).length, 2);
  assert.equal((await projects.list(stranger)).length, 1);
  await assert.rejects(() => projects.get(owned.id, stranger), (error) => error.status === 403);
  await assert.rejects(() => projects.update(owned.id, { name: "Stolen" }, stranger), (error) => error.status === 403);
});
