export class PathForgeClient {
  constructor(baseUrl = "http://localhost:8787") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      body: options.body === undefined || typeof options.body === "string" ? options.body : JSON.stringify(options.body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `PathForge request failed with HTTP ${response.status}.`);
      error.code = payload?.error?.code;
      error.status = response.status;
      error.details = payload?.error?.details;
      throw error;
    }
    return payload;
  }

  health() { return this.request("/health"); }
  readiness() { return this.request("/ready"); }
  config() { return this.request("/api/config"); }
  listProjects() { return this.request("/api/projects"); }
  getProject(id) { return this.request(`/api/projects/${encodeURIComponent(id)}`); }
  createProject(input) { return this.request("/api/projects", { method: "POST", body: input }); }
  updateProject(id, input) { return this.request(`/api/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: input }); }
  inspectToken(address) { return this.request("/api/tokens/inspect", { method: "POST", body: { address } }); }
  lookupTicker(ticker) { return this.request(`/api/hypercore/tickers/${encodeURIComponent(ticker)}`); }
  deployState(deployer) { return this.request("/api/hypercore/deploy-state", { method: "POST", body: { deployer } }); }
  validate(input) { return this.request("/api/preflight/validate", { method: "POST", body: input }); }
  simulate(input) { return this.request("/api/preflight/simulate", { method: "POST", body: input }); }
  draftAction(input) { return this.request("/api/actions/draft", { method: "POST", body: input }); }
  createReport(input) { return this.request("/api/reports/preflight", { method: "POST", body: input }); }
  getReport(id) { return this.request(`/api/reports/${encodeURIComponent(id)}`); }
  validationHistory(projectId) { return this.request(`/api/projects/${encodeURIComponent(projectId)}/validations`); }
  runProjectValidation(projectId, input) { return this.request(`/api/projects/${encodeURIComponent(projectId)}/validations`, { method: "POST", body: input }); }
  listAlerts(projectId) { return this.request(`/api/projects/${encodeURIComponent(projectId)}/alerts`); }
  createAlert(projectId, input) { return this.request(`/api/projects/${encodeURIComponent(projectId)}/alerts`, { method: "POST", body: input }); }
  evaluateAlerts(projectId, snapshot) { return this.request(`/api/projects/${encodeURIComponent(projectId)}/alerts/evaluate`, { method: "POST", body: snapshot }); }
}
