# DXtrade API

Unofficial TypeScript client for the DXtrade trading API.

## Commands

- `npm run build` — Build the project (tsup)
- `npm run dev` — Build in watch mode
- `npm test` — Run tests once (vitest)
- `npm run test:watch` — Run tests in watch mode
- `npm run lint` — Lint source and examples
- `npm run lint:fix` — Lint and auto-fix
- `npm run format` — Format with prettier
- `npm run format:check` — Check formatting
- `npm run commit` — Commit using commitizen (required — `git commit` is disabled via pre-commit hook)

## Project Structure

```
src/
├── client.ts              # Main DxtradeClient class — delegates to domain functions
├── client.types.ts        # Config, callbacks, and context types
├── constants/             # Enums, broker URLs, endpoints, errors
├── domains/               # Feature modules (one folder per domain)
│   ├── {domain}/
│   │   ├── {domain}.ts        # Implementation
│   │   ├── {domain}.types.ts  # Types (namespace pattern)
│   │   └── index.ts           # Barrel exports
│   └── index.ts           # Re-exports all domains
└── utils/                 # Helpers (websocket, cookies, headers, retry)
tests/                     # Unit tests (vitest)
examples/                  # Runnable example scripts
```

## Path Aliases

`@/*` maps to `src/*` — configured in tsconfig.json, tsup.config.ts, and vitest.config.ts.

## Code Style

- **Quotes**: Double quotes
- **Semicolons**: Always
- **Trailing commas**: Always
- **Print width**: 120 characters
- **Indent**: 2 spaces
- **Naming**: camelCase (functions/vars), PascalCase (classes/types/interfaces), SCREAMING_SNAKE_CASE (enum values)
- **Private fields**: Underscore prefix (`_ctx`)
- **Imports**: Named imports, `import type` for type-only imports, `@/` path alias for src
- **Types**: Namespace pattern for domain types (`Order.SubmitParams`, `Symbol.Info`), `interface` for objects, `type` for unions
- **Async**: async/await, Promise wrappers for WebSocket operations with timeout + cleanup
- **Error handling**: Custom `DxtradeError` class, try-catch with `error: unknown` type guards
- **Nullish coalescing**: `??` over `||` for defaults

## Domain Pattern

When adding a new domain:
1. Create `src/domains/{name}/{name}.ts` — implementation functions that take `ClientContext` as first param
2. Create `src/domains/{name}/{name}.types.ts` — types using namespace pattern
3. Create `src/domains/{name}/index.ts` — barrel exports
4. Re-export from `src/domains/index.ts`
5. Add public method(s) to `src/client.ts` with JSDoc comment

## Example Pattern

```typescript
import "dotenv/config";
import { DxtradeClient, BROKER } from "../src";

const client = new DxtradeClient({
  username: process.env.DXTRADE_USERNAME!,
  password: process.env.DXTRADE_PASSWORD!,
  broker: process.env.DXTRADE_BROKER! || BROKER.FTMO,
  accountId: process.env.DXTRADE_ACCOUNT_ID,
  debug: process.env.DXTRADE_DEBUG || false,
});

(async () => {
  await client.connect();
  // ...
})().catch(console.error);
```

## Debugging

When `DXTRADE_DEBUG=true` (or any truthy value) is set in `.env`, all WebSocket messages are logged to `debug.log` in the project root. Use this file to inspect raw WS payloads when troubleshooting features that rely on WebSocket data (orders, positions, OHLC, etc.).

## WebSocket / Atmosphere

DXtrade uses the Atmosphere framework for WebSocket communication. Each WS connection receives a server-assigned tracking ID (UUID) in its first message (format: `"length|tracking-id|0||"`). This ID identifies the Atmosphere session.

**Critical**: All WebSocket connections MUST reuse the same Atmosphere tracking ID (stored as `ctx.atmosphereId`). Opening a new WS with `X-Atmosphere-tracking-id=0` creates a **separate** Atmosphere session. When the server sends data (e.g. chart bars, order updates), it routes to ONE Atmosphere session — if multiple sessions exist, data may go to the wrong (closed) one. This caused intermittent failures where OHLC data was routed to the handshake WS instead of the listener WS.

The fix: `connect()` captures the tracking ID from the handshake and stores it in `ctx.atmosphereId`. All subsequent WS connections pass it via `endpoints.websocket(ctx.broker, ctx.atmosphereId)` so the server reuses the same session.

## Rules

### When adding or removing a feature:
1. Update `README.md` — Features checklist, API section, and Examples section
2. Update `llms.txt` — Keep the LLM reference in sync with the actual API
3. Add JSDoc comment to any new public method in `src/client.ts`
4. Add an example script in `examples/` if the feature is user-facing
5. Add a corresponding npm script in package.json
6. Add or update tests in `tests/`

### Constants and enums:
- **Error codes**: Always use the `ERROR` enum from `@/constants` — never use raw strings for error codes (e.g. `ERROR.OHLC_TIMEOUT`, not `"OHLC_TIMEOUT"`)
- **WebSocket message types**: Always use the `WS_MESSAGE` enum — never use raw strings (e.g. `WS_MESSAGE.POSITIONS`, not `"POSITIONS"`)
- **WebSocket subtopics**: Use `WS_MESSAGE.SUBTOPIC` namespace (e.g. `WS_MESSAGE.SUBTOPIC.BIG_CHART_COMPONENT`)
- When adding a new error code, WebSocket message type, or subtopic, add it to `src/constants/enums.ts`

### General:
- Do not commit with `git commit` directly — use `npm run commit`
- Run `npm run lint` and `npm test` before committing
- Follow the existing domain pattern for new features
