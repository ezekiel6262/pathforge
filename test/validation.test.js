import test from "node:test";
import assert from "node:assert/strict";
import { validateCeremony, validatePlan } from "../src/services/validation.js";
import { coreSystemAddress } from "../src/lib/evm.js";
import { buildAction } from "../src/services/actions.js";

const valid = {
  ticker: "ABC",
  underlyingDecimals: 8,
  weiDecimals: 8,
  szDecimals: 2,
  maxSupply: "1000000000",
  tokenIndex: 1234,
  genesisRecipient: coreSystemAddress(1234),
  genesisAllocations: [{ address: coreSystemAddress(1234), coreWei: "100000000000000000" }],
  noHyperliquidity: true,
  nOrders: 0,
  depositWallet: "0x1111111111111111111111111111111111111111",
  requestedEvmContract: "0x1111111111111111111111111111111111111111",
  genesisComplete: true,
  linkFinalizeRequested: true,
  quoteSymbol: "USDC",
  quoteTokenIndex: 0
};

test("valid plan passes deterministic checks", () => {
  const output = validateCeremony(valid, validatePlan(valid));
  assert.equal(output.valid, true);
  assert.equal(output.summary.warnings, 1);
  assert.equal(output.derived.evmExtraWeiDecimals, 0);
  assert.equal(output.derived.systemAddress, "0x20000000000000000000000000000000000004d2");
});

test("wrong genesis recipient is blocked", () => {
  const input = { ...valid, genesisRecipient: "0x2222222222222222222222222222222222222222" };
  const output = validatePlan(input);
  assert.equal(output.valid, false);
  assert.ok(output.checks.some((check) => check.id === "GENESIS_SYSTEM_ADDRESS" && !check.passed));
});

test("invalid size precision is blocked", () => {
  const output = validatePlan({ ...valid, szDecimals: 4, weiDecimals: 8 });
  assert.equal(output.valid, false);
  assert.ok(output.checks.some((check) => check.id === "SIZE_PRECISION" && !check.passed));
});

test("builds an unsigned genesis action", () => {
  const validation = validateCeremony(valid, validatePlan(valid));
  const draft = buildAction("genesis", valid, validation);
  assert.equal(draft.unsigned, true);
  assert.equal(draft.action.genesis.maxSupply, "100000000000000000");
  assert.equal(draft.action.genesis.noHyperliquidity, true);
});
