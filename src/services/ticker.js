import { assert } from "../lib/errors.js";

export async function lookupTicker(hyperliquid, ticker) {
  assert(typeof ticker === "string" && /^[A-Za-z0-9]{1,6}$/.test(ticker), 400, "INVALID_TICKER", "Ticker must contain 1–6 alphanumeric characters.");
  const normalized = ticker.toUpperCase();
  const meta = await hyperliquid.spotMeta();
  const token = meta.tokens?.find((item) => String(item.name).toUpperCase() === normalized) || null;
  const markets = token ? (meta.universe || []).filter((market) => market.tokens?.includes(token.index)) : [];
  return {
    ticker: normalized,
    available: token === null,
    token,
    markets,
    source: "Hyperliquid testnet spotMeta",
    checkedAt: new Date().toISOString()
  };
}
