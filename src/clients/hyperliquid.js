import { AppError } from "../lib/errors.js";

export class HyperliquidClient {
  constructor(apiUrl, timeoutMs = 10_000) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  async info(body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.apiUrl}/info`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) throw new AppError(502, "HYPERLIQUID_HTTP_ERROR", `Hyperliquid returned HTTP ${response.status}.`);
      return await response.json();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, "HYPERLIQUID_UNAVAILABLE", "Unable to reach the Hyperliquid API.", { cause: error.message });
    } finally {
      clearTimeout(timeout);
    }
  }

  spotMeta() {
    return this.info({ type: "spotMeta" });
  }

  spotDeployState(user) {
    return this.info({ type: "spotDeployState", user });
  }

  spotClearinghouseState(user) {
    return this.info({ type: "spotClearinghouseState", user });
  }
}
