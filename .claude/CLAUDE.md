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

## Rules

### When adding or removing a feature:
1. Update `README.md` — Features checklist, API section, and Examples section
2. Update `llms.txt` — Keep the LLM reference in sync with the actual API
3. Add JSDoc comment to any new public method in `src/client.ts`
4. Add an example script in `examples/` if the feature is user-facing
5. Add a corresponding npm script in package.json
6. Add or update tests in `tests/`

### General:
- Do not commit with `git commit` directly — use `npm run commit`
- Run `npm run lint` and `npm test` before committing
- Follow the existing domain pattern for new features
