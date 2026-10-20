import { assert } from "../lib/errors.js";
import { createId } from "../lib/id.js";
import { isAddress, normalizeAddress } from "../lib/evm.js";

export class ProjectService {
  constructor(store) {
    this.store = store;
  }

  async list(ownerAddress = null) {
    const data = await this.store.read();
    return Object.values(data.projects)
      .filter((project) => !project.ownerAddress || project.ownerAddress === ownerAddress)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id, ownerAddress = null) {
    const data = await this.store.read();
    const project = data.projects[id];
    assert(project, 404, "PROJECT_NOT_FOUND", "Project was not found.", { id });
    assert(!project.ownerAddress || project.ownerAddress === ownerAddress, 403, "PROJECT_FORBIDDEN", "This project belongs to another wallet.");
    return project;
  }

  async create(input, ownerAddress = null) {
    assert(typeof input.name === "string" && input.name.trim().length >= 2, 400, "INVALID_PROJECT_NAME", "Project name must contain at least two characters.");
    assert(isAddress(input.tokenAddress), 400, "INVALID_ADDRESS", "A valid Elysium token address is required.");
    const now = new Date().toISOString();
    const project = {
      id: createId("prj"),
      ownerAddress,
      name: input.name.trim(),
      tokenAddress: normalizeAddress(input.tokenAddress),
      deployerAddress: input.deployerAddress ? normalizeAddress(input.deployerAddress) : null,
      ticker: input.ticker ? String(input.ticker).toUpperCase() : null,
      tokenIndex: input.tokenIndex ?? null,
      stage: "TOKEN_DISCOVERY",
      settings: input.settings || {},
      latestValidationRunId: null,
      latestReportId: null,
      createdAt: now,
      updatedAt: now
    };
    return this.store.transaction((data) => {
      data.projects[project.id] = project;
      return project;
    });
  }

  async update(id, input, ownerAddress = null) {
    return this.store.transaction((data) => {
      const project = data.projects[id];
      assert(project, 404, "PROJECT_NOT_FOUND", "Project was not found.", { id });
      assert(project.ownerAddress && project.ownerAddress === ownerAddress, 403, "PROJECT_FORBIDDEN", "Only the owning wallet can modify this project.");
      if (input.name !== undefined) {
        assert(typeof input.name === "string" && input.name.trim().length >= 2, 400, "INVALID_PROJECT_NAME", "Project name must contain at least two characters.");
        project.name = input.name.trim();
      }
      if (input.deployerAddress !== undefined) project.deployerAddress = input.deployerAddress ? normalizeAddress(input.deployerAddress) : null;
      if (input.ticker !== undefined) project.ticker = input.ticker ? String(input.ticker).toUpperCase() : null;
      if (input.tokenIndex !== undefined) project.tokenIndex = input.tokenIndex;
      if (input.stage !== undefined) project.stage = String(input.stage);
      if (input.settings !== undefined) project.settings = { ...project.settings, ...input.settings };
      project.updatedAt = new Date().toISOString();
      return project;
    });
  }
}
