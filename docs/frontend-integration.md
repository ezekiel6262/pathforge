# Frontend integration contract

Import the zero-dependency client from `sdk/pathforge-client.js` or call the JSON API directly.

```js
import { VeyraClient } from "../sdk/pathforge-client.js";

const veyra = new VeyraClient(import.meta.env.VITE_VEYRA_API_URL);

const project = await veyra.createProject({
  name: "ABC Token",
  tokenAddress: "0x...",
  ticker: "ABC"
});

const token = await veyra.inspectToken(project.tokenAddress);
const ticker = await veyra.lookupTicker("ABC");
```

## Suggested screens and calls

| Screen | Calls |
|---|---|
| Dashboard | `listProjects`, `readiness` |
| New project | `createProject`, `inspectToken` |
| Token overview | `getProject`, `inspectToken`, `lookupTicker` |
| Parameter planner | `validate`, `runProjectValidation` |
| Ceremony | `deployState`, `simulate`, `draftAction` |
| Report | `createReport`, `getReport` |
| Monitoring | `listAlerts`, `createAlert`, `evaluateAlerts` |

## Stable status values

Validation severities are `blocker` and `warning`. Check results use `passed: boolean`.

Lifecycle stage statuses are:

- `not_started`
- `ready`
- `blocked`
- `unavailable`
- `complete`

Actions always return `unsigned: true`. The backend intentionally has no transaction-submission endpoint.
