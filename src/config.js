export const config = Object.freeze({
  port: Number(process.env.PORT || 8787),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  rpcTimeoutMs: Number(process.env.RPC_TIMEOUT_MS || 10_000),
  dataFile: process.env.DATA_FILE || (process.env.VERCEL ? "/tmp/pathforge.json" : ".data/pathforge.json"),
  redisKey: process.env.PATHFORGE_REDIS_KEY || "pathforge:state:v1",
  networks: {
    elysiumTestnet: {
      key: "elysium-testnet",
      name: "Elysium Testnet",
      chainId: 99801,
      rpcUrl: process.env.ELYSIUM_RPC_URL || "https://testnet-rpc.elysium.kinetiq.xyz",
      explorerUrl: "https://elysium.kinetiq.xyz/testnet-explorer",
      contracts: {
        multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
        whype: "0xCD57F65c2B0e5881CFC2E609F7CD53b746E1F234",
        usdc: "0x7D29d8047B905000459c0E80c34a26CeedcB47b2",
        gatewayRouter: "0x89659883a9d980925733B0A698F117AAb65ac718",
        erc20Gateway: "0x30545d8b24185DdFe83E75aB6939f867b664e2E1",
        bridgeFactory: "0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a",
        bridgeWalletGateway: "0x7255150a0340852Fe4B4B5657C5AcE6c09a4F959"
      }
    },
    hyperEvmTestnet: {
      key: "hyperevm-testnet",
      name: "HyperEVM Testnet",
      chainId: 998,
      explorerUrl: "https://testnet.hyperevm-explorer.xyz",
      contracts: {
        mirrorGateway: "0x08922Faa84aC2a54aa3cFD3725b03ca256F52Da2",
        mirrorFactory: "0xcaDb9986F3727177d48FA07294E1730f9D19290b",
        outbox: "0x87391D602aaffB3Fe8051EcCDb75d6EEe8C31060"
      }
    }
  },
  hyperliquid: {
    apiUrl: process.env.HYPERLIQUID_API_URL || "https://api.hyperliquid-testnet.xyz"
  }
});
