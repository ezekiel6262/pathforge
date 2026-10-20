import http from "node:http";
import { config } from "./config.js";
import { JsonRpcClient } from "./clients/json-rpc.js";
import { HyperliquidClient } from "./clients/hyperliquid.js";
import { TokenInspector } from "./services/token-inspector.js";
import { validateCeremony, validatePlan } from "./services/validation.js";
import { buildAction } from "./services/actions.js";
import { resolveLifecycle } from "./services/lifecycle.js";
import { createReport } from "./services/report.js";
import { JsonStore } from "./storage/json-store.js";
import { ProjectService } from "./services/projects.js";
import { AlertService } from "./services/alerts.js";
import { lookupTicker } from "./services/ticker.js";
import { createId } from "./lib/id.js";
import { serveStatic } from "./static.js";
import { AppError } from "./lib/errors.js";
import { readJson, send } from "./http.js";

const rpc = new JsonRpcClient(config.networks.elysiumTestnet.rpcUrl, config.rpcTimeoutMs);
const hyperliquid = new HyperliquidClient(config.hyperliquid.apiUrl, config.rpcTimeoutMs);
const inspector = new TokenInspector(rpc, config.networks.elysiumTestnet);
const store = new JsonStore(config.dataFile);
const projects = new ProjectService(store);
const alerts = new AlertService(store);

async function route(request, response) {
  const requestId = request.headers["x-request-id"] || createId("req");
  response.setHeader("x-request-id", requestId);
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (request.method === "OPTIONS") return send(response, 204, {}, config.corsOrigin);
  if (request.method === "GET" && !url.pathname.startsWith("/api/") && !["/health", "/ready"].includes(url.pathname)) {
    if (await serveStatic(response, url.pathname)) return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return send(response, 200, { ok: true, service: "pathforge-backend", version: "0.1.0", time: new Date().toISOString() }, config.corsOrigin);
  }
  if (request.method === "GET" && url.pathname === "/ready") {
    const checks = await Promise.allSettled([rpc.call("eth_chainId"), hyperliquid.spotMeta()]);
    const dependencies = {
      elysiumRpc: checks[0].status === "fulfilled" && checks[0].value === "0x185d9",
      hyperliquidApi: checks[1].status === "fulfilled" && Array.isArray(checks[1].value?.tokens),
      dataStore: true
    };
    return send(response, Object.values(dependencies).every(Boolean) ? 200 : 503, { ok: Object.values(dependencies).every(Boolean), dependencies, time: new Date().toISOString() }, config.corsOrigin);
  }
  if (request.method === "GET" && url.pathname === "/api/config") {
    return send(response, 200, { networks: config.networks, hyperliquid: { apiUrl: config.hyperliquid.apiUrl }, custody: "none", transactionSubmission: false }, config.corsOrigin);
  }
  if (request.method === "GET" && url.pathname === "/api/hypercore/spot-meta") {
    return send(response, 200, await hyperliquid.spotMeta(), config.corsOrigin);
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/hypercore/tickers/")) {
    return send(response, 200, await lookupTicker(hyperliquid, decodeURIComponent(url.pathname.split("/").at(-1))), config.corsOrigin);
  }
  if (request.method === "GET" && url.pathname === "/api/projects") {
    return send(response, 200, { projects: await projects.list() }, config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/projects") {
    return send(response, 201, await projects.create(await readJson(request)), config.corsOrigin);
  }
  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && request.method === "GET") {
    return send(response, 200, await projects.get(projectMatch[1]), config.corsOrigin);
  }
  if (projectMatch && request.method === "PATCH") {
    return send(response, 200, await projects.update(projectMatch[1], await readJson(request)), config.corsOrigin);
  }
  const projectValidationMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/validations$/);
  if (projectValidationMatch && request.method === "GET") {
    const data = await store.read();
    const runs = Object.values(data.validationRuns).filter((run) => run.projectId === projectValidationMatch[1]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return send(response, 200, { validationRuns: runs }, config.corsOrigin);
  }
  if (projectValidationMatch && request.method === "POST") {
    const project = await projects.get(projectValidationMatch[1]);
    const body = await readJson(request);
    const validation = validateCeremony(body, validatePlan(body));
    const run = { id: createId("val"), projectId: project.id, createdAt: new Date().toISOString(), input: body, result: validation };
    await store.transaction((data) => {
      data.validationRuns[run.id] = run;
      data.projects[project.id].latestValidationRunId = run.id;
      data.projects[project.id].updatedAt = run.createdAt;
      data.projects[project.id].stage = validation.valid ? "PREFLIGHT_READY" : "PREFLIGHT_BLOCKED";
    });
    return send(response, 201, run, config.corsOrigin);
  }
  const reportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
  if (reportMatch && request.method === "GET") {
    const data = await store.read();
    const report = data.reports[reportMatch[1]];
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "Preflight report was not found.");
    return send(response, 200, report, config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/tokens/inspect") {
    const body = await readJson(request);
    const token = await inspector.inspect(body.address);
    return send(response, 200, { token, lifecycle: resolveLifecycle({ token }) }, config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/hypercore/deploy-state") {
    const body = await readJson(request);
    return send(response, 200, await hyperliquid.spotDeployState(body.deployer), config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/preflight/validate") {
    const body = await readJson(request);
    const plan = validatePlan(body);
    return send(response, 200, validateCeremony(body, plan), config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/preflight/simulate") {
    const body = await readJson(request);
    const validation = validateCeremony(body, validatePlan(body));
    const lifecycle = resolveLifecycle({ token: { isContract: true }, hypercore: body.currentHypercoreState, bridge: body.currentBridgeState });
    return send(response, 200, {
      safeToProceed: validation.valid,
      validation,
      current: lifecycle,
      expectedTransition: validation.valid ? body.expectedTransition || "NEXT_STAGE_READY" : "BLOCKED",
      transactionSubmitted: false
    }, config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/actions/draft") {
    const body = await readJson(request);
    const validation = validateCeremony(body, validatePlan(body));
    return send(response, 200, buildAction(body.actionType, body, validation), config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/reports/preflight") {
    const body = await readJson(request);
    const validation = validateCeremony(body, validatePlan(body));
    const lifecycle = resolveLifecycle({ token: { isContract: true }, hypercore: body.currentHypercoreState, bridge: body.currentBridgeState });
    const report = createReport(body, validation, lifecycle);
    if (body.projectId) {
      await store.transaction((data) => {
        if (data.projects[body.projectId]) {
          data.reports[report.reportId] = { ...report, projectId: body.projectId };
          data.projects[body.projectId].latestReportId = report.reportId;
          data.projects[body.projectId].updatedAt = new Date().toISOString();
        }
      });
    }
    return send(response, 200, report, config.corsOrigin);
  }
  const alertListMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/alerts$/);
  if (alertListMatch && request.method === "GET") return send(response, 200, { alerts: await alerts.list(alertListMatch[1]) }, config.corsOrigin);
  if (alertListMatch && request.method === "POST") return send(response, 201, await alerts.create(alertListMatch[1], await readJson(request)), config.corsOrigin);
  const alertEvalMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/alerts\/evaluate$/);
  if (alertEvalMatch && request.method === "POST") return send(response, 200, await alerts.evaluate(alertEvalMatch[1], await readJson(request)), config.corsOrigin);
  throw new AppError(404, "NOT_FOUND", "Route not found.");
}

export function createServer() {
  return http.createServer((request, response) => {
    route(request, response).catch((error) => {
      const status = error instanceof AppError ? error.status : 500;
      send(response, status, {
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: status === 500 ? "Unexpected server error." : error.message,
          details: error.details
        }
      }, config.corsOrigin);
      if (status === 500) console.error(error);
    });
  });
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href) {
  const server = createServer();
  server.listen(config.port, () => {
    console.log(`PathForge backend listening on http://localhost:${config.port}`);
  });
  const shutdown = (signal) => {
    console.log(`${signal} received; closing PathForge backend.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
