import { AppError } from "../lib/errors.js";

export class JsonRpcClient {
  constructor(url, timeoutMs = 10_000) {
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.id = 0;
  }

  async call(method, params = []) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++this.id, method, params }),
        signal: controller.signal
      });
      if (!response.ok) throw new AppError(502, "RPC_HTTP_ERROR", `RPC returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (payload.error) throw new AppError(502, "RPC_ERROR", payload.error.message || "RPC call failed.", payload.error);
      return payload.result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, "RPC_UNAVAILABLE", "Unable to reach the configured Elysium RPC.", { cause: error.message });
    } finally {
      clearTimeout(timeout);
    }
  }

  ethCall(to, data, block = "latest") {
    return this.call("eth_call", [{ to, data }, block]);
  }
}
