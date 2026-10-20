import { ERC20_SELECTORS, decodeAbiString, decodeUint, formatUnits, normalizeAddress } from "../lib/evm.js";

export class TokenInspector {
  constructor(rpc, network) {
    this.rpc = rpc;
    this.network = network;
  }

  async inspect(address) {
    const token = normalizeAddress(address);
    const [code, blockHex, nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all([
      this.rpc.call("eth_getCode", [token, "latest"]),
      this.rpc.call("eth_blockNumber"),
      this.rpc.ethCall(token, ERC20_SELECTORS.name).catch(() => null),
      this.rpc.ethCall(token, ERC20_SELECTORS.symbol).catch(() => null),
      this.rpc.ethCall(token, ERC20_SELECTORS.decimals).catch(() => null),
      this.rpc.ethCall(token, ERC20_SELECTORS.totalSupply).catch(() => null)
    ]);

    const isContract = Boolean(code && code !== "0x");
    const decimals = decimalsHex ? Number(decodeUint(decimalsHex)) : null;
    const totalSupplyRaw = supplyHex ? decodeUint(supplyHex) : null;
    const known = this.knownAsset(token);

    return {
      network: { key: this.network.key, name: this.network.name, chainId: this.network.chainId },
      address: token,
      isContract,
      standard: isContract && decimals !== null && totalSupplyRaw !== null ? "ERC-20-compatible" : "unknown",
      name: nameHex ? decodeAbiString(nameHex) : null,
      symbol: symbolHex ? decodeAbiString(symbolHex) : null,
      decimals,
      totalSupplyRaw: totalSupplyRaw?.toString() ?? null,
      totalSupply: totalSupplyRaw !== null && decimals !== null ? formatUnits(totalSupplyRaw, decimals) : null,
      classification: known ? "canonical" : "unclassified",
      canonicalAsset: known,
      observedAt: { blockNumber: Number(BigInt(blockHex)), timestamp: new Date().toISOString() },
      evidence: { explorer: `${this.network.explorerUrl}/address/${token}` },
      limitations: [
        "Holder distribution requires indexed Transfer history and is not calculated by the lightweight RPC inspector.",
        "Bridge pairing is returned only when a supported registry adapter can prove the relationship."
      ]
    };
  }

  knownAsset(address) {
    const entry = Object.entries(this.network.contracts).find(([, value]) => value.toLowerCase() === address);
    return entry ? { key: entry[0], officialAddress: entry[1] } : null;
  }
}
