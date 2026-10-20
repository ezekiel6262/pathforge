import { coreSystemAddress, parseUnits } from "../lib/evm.js";

const UINT64_MAX = (1n << 64n) - 1n;

function result(id, severity, passed, message, details = {}) {
  return { id, severity, passed, message, details };
}

export function validatePlan(input) {
  const underlyingDecimals = Number(input.underlyingDecimals);
  const weiDecimals = Number(input.weiDecimals);
  const szDecimals = Number(input.szDecimals);
  const tokenIndex = input.tokenIndex === undefined || input.tokenIndex === null ? null : BigInt(input.tokenIndex);
  const evmExtraWeiDecimals = underlyingDecimals - weiDecimals;
  const checks = [];

  checks.push(result("TICKER_LENGTH", "blocker", typeof input.ticker === "string" && /^[A-Za-z0-9]{1,6}$/.test(input.ticker), "Ticker must contain 1–6 alphanumeric characters."));
  checks.push(result("UNDERLYING_DECIMALS", "blocker", Number.isInteger(underlyingDecimals) && underlyingDecimals >= 0 && underlyingDecimals <= 36, "Underlying decimals must be an integer between 0 and 36."));
  checks.push(result("WEI_DECIMALS", "blocker", Number.isInteger(weiDecimals) && weiDecimals >= 0 && weiDecimals <= 18, "Core weiDecimals must be an integer between 0 and 18."));
  checks.push(result("SIZE_DECIMALS", "blocker", Number.isInteger(szDecimals) && szDecimals >= 0, "szDecimals must be a non-negative integer."));
  checks.push(result("SIZE_PRECISION", "blocker", szDecimals + 5 <= weiDecimals, "HyperCore requires szDecimals + 5 <= weiDecimals.", { szDecimals, weiDecimals }));
  checks.push(result("EVM_EXTRA_WEI_DECIMALS", "blocker", evmExtraWeiDecimals >= -2 && evmExtraWeiDecimals <= 18, "evmExtraWeiDecimals must be between -2 and 18.", { evmExtraWeiDecimals }));

  let maxSupplyCoreWei = null;
  try {
    maxSupplyCoreWei = parseUnits(input.maxSupply, weiDecimals);
    checks.push(result("MAX_SUPPLY_POSITIVE", "blocker", maxSupplyCoreWei > 0n, "Maximum supply must be greater than zero."));
    checks.push(result("UINT64_CAPACITY", "blocker", maxSupplyCoreWei <= UINT64_MAX, "Maximum supply in Core wei must fit uint64.", { max: UINT64_MAX.toString(), proposed: maxSupplyCoreWei.toString() }));
    const headroom = maxSupplyCoreWei <= UINT64_MAX ? UINT64_MAX - maxSupplyCoreWei : 0n;
    const hasConservativeHeadroom = maxSupplyCoreWei > 0n && maxSupplyCoreWei <= UINT64_MAX / 1000n;
    checks.push(result("UINT64_HEADROOM", "warning", hasConservativeHeadroom, "Supply fits within uint64 but leaves less than the conservative 1000× headroom target.", { headroom: headroom.toString(), conservativeMaximum: (UINT64_MAX / 1000n).toString() }));
  } catch (error) {
    checks.push(result("MAX_SUPPLY_FORMAT", "blocker", false, error.message));
  }

  if (input.underlyingTotalSupply !== undefined && maxSupplyCoreWei !== null) {
    try {
      const underlyingSupply = parseUnits(input.underlyingTotalSupply, weiDecimals);
      checks.push(result("BACKS_FULL_SUPPLY", "blocker", maxSupplyCoreWei >= underlyingSupply, "For a bridged token, max supply should cover the entire underlying supply.", { underlyingSupplyCoreWei: underlyingSupply.toString() }));
    } catch (error) {
      checks.push(result("UNDERLYING_SUPPLY_FORMAT", "blocker", false, error.message));
    }
  }

  const expectedSystemAddress = tokenIndex === null ? null : coreSystemAddress(tokenIndex);
  if (input.genesisRecipient && expectedSystemAddress) {
    checks.push(result("GENESIS_SYSTEM_ADDRESS", "blocker", input.genesisRecipient.toLowerCase() === expectedSystemAddress, "Bridged-token genesis must allocate the full supply to the Core system address.", { expected: expectedSystemAddress, received: input.genesisRecipient.toLowerCase() }));
  }

  const blockers = checks.filter((check) => check.severity === "blocker" && !check.passed);
  const warnings = checks.filter((check) => check.severity === "warning" && !check.passed);
  return {
    valid: blockers.length === 0,
    summary: { passed: checks.filter((check) => check.passed).length, blockers: blockers.length, warnings: warnings.length, total: checks.length },
    derived: {
      ticker: typeof input.ticker === "string" ? input.ticker.toUpperCase() : null,
      evmExtraWeiDecimals,
      maxSupplyCoreWei: maxSupplyCoreWei?.toString() ?? null,
      systemAddress: expectedSystemAddress
    },
    checks
  };
}

export function validateCeremony(input, plan) {
  const checks = [...plan.checks];
  const add = (id, severity, passed, message, details = {}) => checks.push(result(id, severity, passed, message, details));

  if (Array.isArray(input.genesisAllocations) && plan.derived.maxSupplyCoreWei) {
    let total = 0n;
    try {
      total = input.genesisAllocations.reduce((sum, allocation) => sum + BigInt(allocation.coreWei), 0n);
      add("GENESIS_SUM", "blocker", total.toString() === plan.derived.maxSupplyCoreWei, "Staged genesis allocations must equal maxSupply exactly.", { staged: total.toString(), expected: plan.derived.maxSupplyCoreWei });
      if (plan.derived.systemAddress) {
        const outside = input.genesisAllocations.filter((allocation) => allocation.address.toLowerCase() !== plan.derived.systemAddress);
        add("GENESIS_BACKING", "blocker", outside.length === 0, "For a bridged token, every genesis allocation must target the system address.", { invalidRecipients: outside.map((item) => item.address) });
      }
    } catch {
      add("GENESIS_ALLOCATION_FORMAT", "blocker", false, "Every genesis allocation must contain an integer Core-wei amount.");
    }
  }

  if (input.depositWallet && input.requestedEvmContract) {
    add("LINK_TARGET", "blocker", input.depositWallet.toLowerCase() === input.requestedEvmContract.toLowerCase(), "HyperCore must link to the deposit wallet, not the underlying ERC-20.");
  }
  if (input.genesisComplete !== undefined && input.linkFinalizeRequested) {
    add("GENESIS_BEFORE_LINK", "blocker", input.genesisComplete === true, "Genesis must complete before finalizing the EVM link.");
  }
  if (input.noHyperliquidity === true && input.nOrders !== undefined) {
    add("NO_HYPERLIQUIDITY_ORDERS", "blocker", Number(input.nOrders) === 0, "nOrders must be 0 when Hyperliquidity is disabled.");
  }
  if (input.quoteTokenIndex !== undefined) {
    const isUsdc = String(input.quoteSymbol || "").toUpperCase() === "USDC";
    if (isUsdc) add("USDC_INDEX", "blocker", Number(input.quoteTokenIndex) === 0, "HyperCore USDC uses token index 0.");
  }

  const blockers = checks.filter((check) => check.severity === "blocker" && !check.passed);
  const warnings = checks.filter((check) => check.severity === "warning" && !check.passed);
  return { ...plan, valid: blockers.length === 0, summary: { passed: checks.filter((check) => check.passed).length, blockers: blockers.length, warnings: warnings.length, total: checks.length }, checks };
}
