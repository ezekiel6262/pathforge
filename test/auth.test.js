import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { clearSession, createWalletChallenge, readSession, verifyWalletChallenge } from "../src/auth.js";

class MockResponse {
  constructor() { this.headers = new Map(); }
  setHeader(name, value) { this.headers.set(name.toLowerCase(), value); }
  getHeader(name) { return this.headers.get(name.toLowerCase()); }
}

const cookiePair = (setCookie) => String(setCookie).split(";", 1)[0];

test("authenticates a wallet challenge into an HTTP-only session", async () => {
  process.env.PATHFORGE_SESSION_SECRET = "test-secret-that-is-long-enough-for-hmac";
  const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  const challengeResponse = new MockResponse();
  const challenge = createWalletChallenge({ headers: { host: "pathforge.test" } }, challengeResponse, account.address);
  const signature = await account.signMessage({ message: challenge.message });

  const verifyResponse = new MockResponse();
  const result = await verifyWalletChallenge({ headers: { cookie: cookiePair(challengeResponse.getHeader("set-cookie")) } }, verifyResponse, { message: challenge.message, signature });
  assert.equal(result.address, account.address.toLowerCase());

  const sessionCookie = verifyResponse.getHeader("set-cookie")[0];
  assert.match(sessionCookie, /HttpOnly/);
  assert.equal(readSession({ headers: { cookie: cookiePair(sessionCookie) } }).address, account.address.toLowerCase());
  const logoutResponse = new MockResponse();
  assert.equal(clearSession(logoutResponse).authenticated, false);
});
