# Veyra

Veyra is a full-stack, non-custodial lifecycle console for Elysium-to-HyperCore graduation. It combines live evidence, deterministic preflight validation, simulation, unsigned action drafts, reports, project history, monitoring, and alerts. Wallet signatures authenticate workspace ownership only; Veyra never signs or broadcasts a transaction.

- Live product: [veyra.vercel.app](https://veyra.vercel.app)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Hackathon summary and demo script: [docs/hackathon-submission.md](docs/hackathon-submission.md)

## Run

Requires Node.js 24.

```powershell
Copy-Item .env.example .env
npm.cmd start
```

On Windows, no terminal commands are required: double-click `Start PathForge.cmd`. Use `Test PathForge.cmd` to run the verification suite. These compatibility launchers retain their original filenames.

Environment variables can be set by the deployment platform. The service defaults to port `8787` and the public Elysium testnet RPC.

## Test

```powershell
npm.cmd test
```

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Service health |
| GET | `/ready` | Live dependency readiness |
| GET | `/api/config` | Public network registry |
| GET | `/api/hypercore/spot-meta` | HyperCore testnet spot metadata proxy |
| GET | `/api/hypercore/tickers/:ticker` | Check ticker registration and markets |
| POST | `/api/auth/challenge` | Issue a short-lived wallet sign-in challenge |
| POST | `/api/auth/verify` | Verify the signed challenge and create an HTTP-only session |
| GET | `/api/auth/session` | Read the current wallet session |
| POST | `/api/auth/logout` | Clear the wallet session |
| GET/POST | `/api/projects` | List or create saved project workspaces |
| GET/PATCH/DELETE | `/api/projects/:id` | Read, update, or delete a project workspace |
| GET/POST | `/api/projects/:id/validations` | Read or execute saved validation runs |
| GET | `/api/projects/:id/reports` | List saved project reports |
| GET | `/api/projects/:id/monitoring` | Refresh source-labelled public lifecycle evidence |
| POST | `/api/tokens/inspect` | Inspect an Elysium ERC-20 |
| POST | `/api/hypercore/deploy-state` | Read deployer ceremony state |
| POST | `/api/preflight/validate` | Run deterministic validations |
| POST | `/api/preflight/simulate` | Simulate a lifecycle transition |
| POST | `/api/actions/draft` | Generate an unsigned action |
| POST | `/api/reports/preflight` | Generate a JSON preflight report |
| GET | `/api/reports/:id` | Retrieve a saved report |
| GET/POST | `/api/projects/:id/alerts` | List or create alert rules |
| POST | `/api/projects/:id/alerts/evaluate` | Evaluate rules against a snapshot |

### Inspect a token

```json
POST /api/tokens/inspect
{
  "address": "0x7D29d8047B905000459c0E80c34a26CeedcB47b2"
}
```

### Validate a plan

```json
POST /api/preflight/validate
{
  "ticker": "ABC",
  "underlyingDecimals": 8,
  "weiDecimals": 8,
  "szDecimals": 2,
  "maxSupply": "1000000000",
  "tokenIndex": 1234,
  "genesisRecipient": "0x20000000000000000000000000000000000004d2",
  "genesisAllocations": [
    {
      "address": "0x20000000000000000000000000000000000004d2",
      "coreWei": "100000000000000000"
    }
  ],
  "noHyperliquidity": true,
  "nOrders": 0
}
```

## Safety boundary

The API never asks for private keys, signs actions, broadcasts transactions, or claims official Ascend qualification. The only wallet signature is a server-issued, nonce-bound authentication message with an expiry and explicit no-transaction statement. Sessions use signed, HTTP-only, `SameSite=Strict` cookies; write operations are scoped to the authenticated owner. Deposit-wallet integration remains adapter-based until official deployment addresses are published.

## Container deployment

```powershell
docker build -t veyra-api .
docker run --rm -p 8787:8787 -v veyra-data:/app/.data veyra-api
```

The API contract is documented in `openapi.yaml`.
The browser client is in `sdk/pathforge-client.js` (compatibility filename), with screen-level guidance in `docs/frontend-integration.md`.
