import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { verifyMessage } from "viem";
import { AppError, assert } from "./lib/errors.js";
import { isAddress, normalizeAddress } from "./lib/evm.js";

const SESSION_COOKIE = "pathforge_session";
const CHALLENGE_COOKIE = "pathforge_challenge";
const localSecret = randomBytes(32).toString("hex");
const secret = () => process.env.PATHFORGE_SESSION_SECRET || localSecret;

function cookies(request) {
  return Object.fromEntries(String(request.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(value) {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", secret()).update(encoded).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  return payload.exp > Date.now() ? payload : null;
}

function setCookie(response, name, value, maxAge) {
  const secure = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  const previous = response.getHeader?.("set-cookie");
  response.setHeader("set-cookie", previous ? [...(Array.isArray(previous) ? previous : [previous]), cookie] : cookie);
}

export function createWalletChallenge(request, response, address) {
  assertRequestOrigin(request);
  assert(isAddress(address), 400, "INVALID_ADDRESS", "A valid wallet address is required.");
  const normalized = normalizeAddress(address);
  const nonce = randomBytes(16).toString("hex");
  const host = request.headers.host || "pathforge";
  const issuedAt = new Date().toISOString();
  const message = `${host} wants you to sign in to Veyra\n\nWallet: ${normalized}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nPurpose: Authenticate project ownership. No transaction will be submitted.`;
  setCookie(response, CHALLENGE_COOKIE, sign({ address: normalized, nonce, message, exp: Date.now() + 10 * 60_000 }), 10 * 60);
  return { address: normalized, message, expiresIn: 600 };
}

export async function verifyWalletChallenge(request, response, input) {
  assertRequestOrigin(request);
  const challenge = verify(cookies(request)[CHALLENGE_COOKIE]);
  assert(challenge, 401, "CHALLENGE_EXPIRED", "Wallet challenge is missing or expired.");
  assert(input.message === challenge.message, 401, "CHALLENGE_MISMATCH", "Signed message does not match the issued challenge.");
  const valid = await verifyMessage({ address: challenge.address, message: challenge.message, signature: input.signature }).catch(() => false);
  assert(valid, 401, "INVALID_SIGNATURE", "Wallet signature could not be verified.");
  const session = { address: challenge.address, exp: Date.now() + 7 * 24 * 60 * 60_000 };
  setCookie(response, SESSION_COOKIE, sign(session), 7 * 24 * 60 * 60);
  setCookie(response, CHALLENGE_COOKIE, "", 0);
  return { authenticated: true, address: session.address };
}

export function readSession(request) {
  const session = verify(cookies(request)[SESSION_COOKIE]);
  return session?.address ? { address: session.address } : null;
}

export function requireSession(request) {
  const session = readSession(request);
  if (!session) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Connect and sign with a wallet to continue.");
  return session;
}

export function clearSession(request, response) {
  assertRequestOrigin(request);
  setCookie(response, SESSION_COOKIE, "", 0);
  return { authenticated: false };
}

export function assertRequestOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  let originHost;
  try { originHost = new URL(origin).host; } catch { throw new AppError(403, "INVALID_ORIGIN", "Request origin is invalid."); }
  assert(originHost === request.headers.host, 403, "INVALID_ORIGIN", "Cross-origin authentication requests are not allowed.");
}
