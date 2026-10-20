import { AppError } from "../lib/errors.js";

export function buildAction(type, input, validation) {
  if (!validation.valid) throw new AppError(422, "PREFLIGHT_FAILED", "Action cannot be drafted while blocking checks are failing.", validation.summary);
  const token = Number(input.tokenIndex);
  const builders = {
    registerToken: () => ({
      type: "spotDeploy",
      registerToken2: {
        name: validation.derived.ticker,
        szDecimals: Number(input.szDecimals),
        weiDecimals: Number(input.weiDecimals),
        maxGas: String(input.maxGas),
        fullName: String(input.fullName || validation.derived.ticker)
      }
    }),
    userGenesis: () => ({
      type: "spotDeploy",
      userGenesis: {
        token,
        userAndWei: input.genesisAllocations.map((item) => [item.address.toLowerCase(), String(item.coreWei)]),
        existingTokenAndWei: []
      }
    }),
    genesis: () => ({ type: "spotDeploy", genesis: { token, maxSupply: validation.derived.maxSupplyCoreWei, noHyperliquidity: Boolean(input.noHyperliquidity) || undefined } }),
    requestEvmContract: () => ({
      type: "spotDeploy",
      requestEvmContract: { token, address: input.depositWallet.toLowerCase(), evmExtraWeiDecimals: validation.derived.evmExtraWeiDecimals }
    }),
    finalizeEvmContract: () => ({ type: "finalizeEvmContract", token, input: input.proofMethod || "customStorageSlot" }),
    registerSpot: () => ({ type: "spotDeploy", registerSpot: { tokens: [token, Number(input.quoteTokenIndex ?? 0)] } }),
    registerHyperliquidity: () => ({
      type: "spotDeploy",
      registerHyperliquidity: {
        spot: Number(input.spotIndex),
        startPx: String(input.startPx),
        orderSz: String(input.orderSz || "1"),
        nOrders: Number(input.nOrders ?? 0)
      }
    })
  };
  const builder = builders[type];
  if (!builder) throw new AppError(400, "UNSUPPORTED_ACTION", `Unsupported action type: ${type}.`, { supported: Object.keys(builders) });
  return {
    unsigned: true,
    actionType: type,
    action: builder(),
    warnings: ["This payload has not been signed or submitted.", "Refresh canonical chain state immediately before signing."],
    generatedAt: new Date().toISOString()
  };
}
