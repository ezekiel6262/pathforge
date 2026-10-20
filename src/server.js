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
import { RedisStore } from "./storage/redis-store.js";
import { ProjectService } from "./services/projects.js";
import { AlertService } from "./services/alerts.js";
import { lookupTicker } from "./services/ticker.js";
import { createId } from "./lib/id.js";
import { serveStatic } from "./static.js";
import { AppError, assert } from "./lib/errors.js";
import { readJson, send } from "./http.js";
import { clearSession, createWalletChallenge, readSession, requireSession, verifyWalletChallenge } from "./auth.js";
import { RateLimiter } from "./rate-limit.js";

const rpc = new JsonRpcClient(config.networks.elysiumTestnet.rpcUrl, config.rpcTimeoutMs);
const hyperliquid = new HyperliquidClient(config.hyperliquid.apiUrl, config.rpcTimeoutMs);
const inspector = new TokenInspector(rpc, config.networks.elysiumTestnet);
const store = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? RedisStore.fromEnv(config.redisKey)
  : new JsonStore(config.dataFile);
const projects = new ProjectService(store);
const alerts = new AlertService(store);
const rateLimiter = RateLimiter.fromEnv();
const clientIp = (request) => String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",")[0].trim();

export async function route(request, response) {
  const requestId = request.headers["x-request-id"] || createId("req");
  response.setHeader("x-request-id", requestId);
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
  response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("content-security-policy", "default-src 'self'; connect-src 'self' https://testnet-rpc.elysium.kinetiq.xyz https://api.hyperliquid-testnet.xyz; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (request.method === "OPTIONS") return send(response, 204, {}, config.corsOrigin);
  if (request.method === "GET" && !url.pathname.startsWith("/api/") && !["/health", "/ready"].includes(url.pathname)) {
    if (await serveStatic(response, url.pathname)) return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return send(response, 200, { ok: true, service: "veyra", version: "0.1.0", time: new Date().toISOString() }, config.corsOrigin);
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
  if (request.method === "POST" && url.pathname === "/api/auth/challenge") {
    await rateLimiter.check(`auth:${clientIp(request)}`, 10, 60);
    const body = await readJson(request);
    return send(response, 200, createWalletChallenge(request, response, body.address), config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/auth/verify") {
    await rateLimiter.check(`auth:${clientIp(request)}`, 10, 60);
    return send(response, 200, await verifyWalletChallenge(request, response, await readJson(request)), config.corsOrigin);
  }
  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const session = readSession(request);
    return send(response, 200, session ? { authenticated: true, ...session } : { authenticated: false }, config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    return send(response, 200, clearSession(request, response), config.corsOrigin);
  }
  if (request.method === "GET" && url.pathname === "/api/hypercore/spot-meta") {
    return send(response, 200, await hyperliquid.spotMeta(), config.corsOrigin);
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/hypercore/tickers/")) {
    return send(response, 200, await lookupTicker(hyperliquid, decodeURIComponent(url.pathname.split("/").at(-1))), config.corsOrigin);
  }
  if (request.method === "GET" && url.pathname === "/api/projects") {
    return send(response, 200, { projects: await projects.list(readSession(request)?.address) }, config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/projects") {
    return send(response, 201, await projects.create(await readJson(request), requireSession(request).address), config.corsOrigin);
  }
  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && request.method === "GET") {
    return send(response, 200, await projects.get(projectMatch[1], readSession(request)?.address), config.corsOrigin);
  }
  if (projectMatch && request.method === "PATCH") {
    return send(response, 200, await projects.update(projectMatch[1], await readJson(request), requireSession(request).address), config.corsOrigin);
  }
  if (projectMatch && request.method === "DELETE") {
    return send(response, 200, await projects.delete(projectMatch[1], requireSession(request).address), config.corsOrigin);
  }
  const projectValidationMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/validations$/);
  if (projectValidationMatch && request.method === "GET") {
    await projects.get(projectValidationMatch[1], readSession(request)?.address);
    const data = await store.read();
    const runs = Object.values(data.validationRuns).filter((run) => run.projectId === projectValidationMatch[1]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return send(response, 200, { validationRuns: runs }, config.corsOrigin);
  }
  if (projectValidationMatch && request.method === "POST") {
    const project = await projects.get(projectValidationMatch[1], requireSession(request).address);
    assert(project.ownerAddress, 403, "PROJECT_READ_ONLY", "Public demo projects are read-only.");
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
  const projectReportListMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/reports$/);
  if (projectReportListMatch && request.method === "GET") {
    await projects.get(projectReportListMatch[1], readSession(request)?.address);
    const data = await store.read();
    const reports = Object.values(data.reports).filter((item) => item.projectId === projectReportListMatch[1]).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    return send(response, 200, { reports }, config.corsOrigin);
  }
  const projectMonitoringMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/monitoring$/);
  if (projectMonitoringMatch && request.method === "GET") {
    const project = await projects.get(projectMonitoringMatch[1], readSession(request)?.address);
    const [tokenResult, tickerResult, deployResult] = await Promise.allSettled([
      inspector.inspect(project.tokenAddress),
      project.ticker ? lookupTicker(hyperliquid, project.ticker) : Promise.resolve(null),
      project.deployerAddress ? hyperliquid.spotDeployState(project.deployerAddress) : Promise.resolve(null)
    ]);
    const token = tokenResult.status === "fulfilled" ? tokenResult.value : null;
    const ticker = tickerResult.status === "fulfilled" ? tickerResult.value : null;
    const deployState = deployResult.status === "fulfilled" ? deployResult.value : null;
    return send(response, 200, {
      projectId: project.id,
      checkedAt: new Date().toISOString(),
      token: { status: token?.isContract ? "observed" : "unavailable", value: token, source: "Elysium testnet RPC" },
      ticker: project.ticker ? { status: ticker ? (ticker.available ? "available" : "registered") : "unavailable", value: ticker, source: "Hyperliquid testnet spotMeta" } : { status: "not_configured", value: null },
      deployer: project.deployerAddress ? { status: deployState ? "observed" : "unavailable", value: deployState, source: "Hyperliquid testnet spotDeployState" } : { status: "not_configured", value: null },
      bridgeSync: { status: "unavailable", value: null, reason: "No public Elysium-to-HyperCore message-index adapter is published." },
      permanentLink: { status: "unavailable", value: null, reason: "No public authoritative permanent-link registry adapter is published." },
      orderBook: ticker?.markets?.length ? { status: "registered", value: ticker.markets, source: "Hyperliquid testnet spotMeta" } : { status: "not_registered", value: [] },
      disclaimer: "Unavailable states are intentionally not inferred from private Ascend criteria."
    }, config.corsOrigin);
  }
  const reportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
  if (reportMatch && request.method === "GET") {
    const data = await store.read();
    const report = data.reports[reportMatch[1]];
    if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "Preflight report was not found.");
    if (report.projectId) await projects.get(report.projectId, readSession(request)?.address);
    return send(response, 200, report, config.corsOrigin);
  }
  if (request.method === "POST" && url.pathname === "/api/tokens/inspect") {
    await rateLimiter.check(`rpc:${clientIp(request)}`, 60, 60);
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
      const project = await projects.get(body.projectId, requireSession(request).address);
      assert(project.ownerAddress, 403, "PROJECT_READ_ONLY", "Public demo projects are read-only.");
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
  if (alertListMatch && request.method === "GET") {
    await projects.get(alertListMatch[1], readSession(request)?.address);
    return send(response, 200, { alerts: await alerts.list(alertListMatch[1]) }, config.corsOrigin);
  }
  if (alertListMatch && request.method === "POST") {
    const project = await projects.get(alertListMatch[1], requireSession(request).address);
    assert(project.ownerAddress, 403, "PROJECT_READ_ONLY", "Public demo projects are read-only.");
    return send(response, 201, await alerts.create(alertListMatch[1], await readJson(request)), config.corsOrigin);
  }
  const alertEvalMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/alerts\/evaluate$/);
  if (alertEvalMatch && request.method === "POST") {
    const project = await projects.get(alertEvalMatch[1], requireSession(request).address);
    assert(project.ownerAddress, 403, "PROJECT_READ_ONLY", "Public demo projects are read-only.");
    return send(response, 200, await alerts.evaluate(alertEvalMatch[1], await readJson(request)), config.corsOrigin);
  }
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
    console.log(`Veyra backend listening on http://localhost:${config.port}`);
  });
  const shutdown = (signal) => {
    console.log(`${signal} received; closing Veyra backend.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
