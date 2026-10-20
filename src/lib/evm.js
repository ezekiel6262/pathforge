import { AppError, assert } from "./errors.js";

export const ERC20_SELECTORS = Object.freeze({
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd"
});

export function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function normalizeAddress(value) {
  assert(isAddress(value), 400, "INVALID_ADDRESS", "Expected a 20-byte EVM address.", { value });
  return value.toLowerCase();
}

export function decodeUint(hex) {
  if (!hex || hex === "0x") throw new AppError(422, "EMPTY_CALL_RESULT", "Contract call returned no data.");
  return BigInt(hex);
}

export function decodeAbiString(hex) {
  if (!hex || hex === "0x") return null;
  const raw = hex.slice(2);
  try {
    if (raw.length === 64) {
      return Buffer.from(raw.replace(/(00)+$/, ""), "hex").toString("utf8") || null;
    }
    const offset = Number(BigInt(`0x${raw.slice(0, 64)}`)) * 2;
    const length = Number(BigInt(`0x${raw.slice(offset, offset + 64)}`));
    return Buffer.from(raw.slice(offset + 64, offset + 64 + length * 2), "hex").toString("utf8");
  } catch {
    return null;
  }
}

export function formatUnits(value, decimals) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = (absolute % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function parseUnits(value, decimals) {
  assert(typeof value === "string" || typeof value === "number", 400, "INVALID_AMOUNT", "Amount must be a string or number.");
  const input = String(value).trim();
  assert(/^\d+(\.\d+)?$/.test(input), 400, "INVALID_AMOUNT", "Amount must be a positive decimal number.", { value });
  const [whole, fraction = ""] = input.split(".");
  assert(fraction.length <= decimals, 400, "TOO_MANY_DECIMALS", `Amount has more than ${decimals} decimal places.`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction.padEnd(decimals, "0") || "0"));
}

export function coreSystemAddress(tokenIndex) {
  const index = BigInt(tokenIndex);
  assert(index >= 0n && index <= ((1n << 64n) - 1n), 400, "INVALID_TOKEN_INDEX", "Token index must fit uint64.");
  const prefix = 0x20n << 152n;
  return `0x${(prefix | index).toString(16).padStart(40, "0")}`;
}
