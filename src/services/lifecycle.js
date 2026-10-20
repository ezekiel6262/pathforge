export function resolveLifecycle({ token, hypercore = null, bridge = null }) {
  const stages = [
    { key: "TOKEN_INSPECTED", label: "Token inspected", status: token?.isContract ? "complete" : "blocked" },
    { key: "PARAMETERS_VALIDATED", label: "Decimals and supply validated", status: "ready" },
    { key: "TICKER_ACQUIRED", label: "Ticker acquired", status: hypercore?.token ? "complete" : "not_started" },
    { key: "DEPOSIT_WALLET", label: "Deposit wallet resolved", status: bridge?.depositWallet ? "complete" : "unavailable" },
    { key: "GENESIS", label: "Core genesis finalized", status: hypercore?.maxSupply ? "complete" : "not_started" },
    { key: "EVM_LINK", label: "EVM contract linked", status: hypercore?.evmContract ? "complete" : "not_started" },
    { key: "SPOT_REGISTERED", label: "Spot pair registered", status: hypercore?.spotPair ? "complete" : "not_started" },
    { key: "ORDERBOOK_ACTIVE", label: "Order book active", status: hypercore?.listed ? "complete" : "not_started" }
  ];
  const current = [...stages].reverse().find((stage) => stage.status === "complete") || stages[0];
  return { currentStage: current.key, stages };
}
