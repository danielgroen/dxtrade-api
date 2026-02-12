# DXtrade API

[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![npm downloads](https://img.shields.io/npm/dm/@danielgroen/dxtrade-api)](https://www.npmjs.com/package/@danielgroen/dxtrade-api)
[![license](https://img.shields.io/npm/l/@danielgroen/dxtrade-api)](LICENSE)
[![Tests](https://github.com/danielgroen/dxtrade-api/actions/workflows/tests.yml/badge.svg)](https://github.com/danielgroen/dxtrade-api/actions/workflows/tests.yml)
[![Publish](https://github.com/danielgroen/dxtrade-api/actions/workflows/publish.yml/badge.svg)](https://github.com/danielgroen/dxtrade-api/actions/workflows/publish.yml)

[![DXtrade API](https://raw.githubusercontent.com/danielgroen/dxtrade-api/master/public/logo-dxtrade.svg)](https://demo.dx.trade/developers/#/)

Unofficial Node.js client for the DXtrade trading API with full TypeScript support. Connect, trade, and manage positions on any broker that supports DXtrade.

## Install

```bash
npm install dxtrade-api
```

## Features

- [x] Authentication & session management
- [x] Submit orders (market, limit, stop)
- [x] Get & cancel orders
- [x] Positions (get, close, close all)
- [x] Position metrics (per-position P&L)
- [x] Account metrics, trade journal & trade history
- [x] Symbol search & instrument info
- [x] OHLC / price bar data
- [x] PnL assessments
- [x] Multi-broker support (FTMO, Eightcap, Lark Funding)
- [x] Persistent WebSocket with `connect()`
- [x] Real-time position streaming
- [x] Full TypeScript support
- [ ] Batch orders
- [ ] Modify existing orders
- [ ] Real-time price streaming

## Quick Start

```ts
import { DxtradeClient, ORDER_TYPE, SIDE, BROKER } from "dxtrade-api";

const client = new DxtradeClient({
  username: "your_username",
  password: "your_password",
  broker: BROKER.FTMO,
  accountId: "optional_account_id",
});

// connect() = auth + persistent WebSocket (recommended)
await client.connect();

const suggestions = await client.symbols.search("EURUSD");
const symbol = suggestions[0];

const order = await client.orders.submit({
  symbol: symbol.name,
  side: SIDE.BUY,
  quantity: 0.01,
  orderType: ORDER_TYPE.MARKET,
  instrumentId: symbol.id,
});

console.log(`Order ${order.orderId}: ${order.status}`);
client.disconnect();
```

## Connection Modes

```ts
// Persistent WebSocket (recommended) — reuses one WS for all data, enables streaming
await client.connect();
client.disconnect(); // when done

// Lightweight — auth only, each data call opens a temporary WebSocket
await client.auth();
```

## Configuration

| Option | Type | Required | Description |
|---|---|---|---|
| `username` | `string` | Yes | DXtrade account username |
| `password` | `string` | Yes | DXtrade account password |
| `broker` | `string` | Yes | Broker identifier (e.g. `"LARKFUNDING"`, `"EIGHTCAP"`) |
| `accountId` | `string` | No | Account ID to auto-switch after login |
| `brokerUrls` | `Record<string, string>` | No | Custom broker URL mapping |
| `retries` | `number` | No | Retry count for failed requests (default: 3) |
| `debug` | `boolean \| string` | No | Enable debug logging (`true` for all, or a WS message type to filter) |
| `callbacks` | `DxtradeCallbacks` | No | Event callbacks |

## Built-in Brokers

```ts
import { BROKER } from "dxtrade-api";

BROKER.LARKFUNDING  // "https://trade.gooeytrade.com"
BROKER.EIGHTCAP     // "https://trader.dx-eightcap.com"
BROKER.FTMO         // "https://dxtrade.ftmo.com"
```

## API

### Session

- `client.connect()` — Auth + persistent WebSocket. Recommended for most use cases.
- `client.auth()` — Lightweight: login, fetch CSRF, WebSocket handshake, optional account switch. No persistent WS.
- `client.disconnect()` — Close the persistent WebSocket connection
- `client.login()` — Authenticate with broker
- `client.fetchCsrf()` — Fetch CSRF token from broker page
- `client.switchAccount(accountId)` — Switch to a specific account

### Positions

- `client.positions.get()` — Get all open positions with P&L metrics merged (margin, plOpen, marketValue, etc.)
- `client.positions.close(params)` — Close a position (supports partial closes via the quantity field)
- `client.positions.closeAll()` — Close all open positions with market orders
- `client.positions.stream(callback)` — Stream real-time position updates with live P&L (requires `connect()`). Returns an unsubscribe function.

### Orders

- `client.orders.get()` — Get all pending/open orders
- `client.orders.submit(params)` — Submit an order and wait for WebSocket confirmation
- `client.orders.cancel(orderChainId)` — Cancel a single pending order
- `client.orders.cancelAll()` — Cancel all pending orders

### Account

- `client.account.metrics()` — Get account metrics (equity, balance, margin, open P&L, etc.)
- `client.account.tradeJournal({ from, to })` — Fetch trade journal entries for a date range (Unix timestamps)
- `client.account.tradeHistory({ from, to })` — Fetch trade history for a date range (Unix timestamps)

### Symbols

- `client.symbols.search(text)` — Search for symbols
- `client.symbols.info(symbol)` — Get instrument info (volume limits, lot size)
- `client.symbols.limits()` — Get order size limits and stop/limit distances for all symbols

### Instruments

- `client.instruments.get(params?)` — Get all available instruments, optionally filtered by partial match (e.g. `{ type: "FOREX" }`)

### OHLC

- `client.ohlc.get(params)` — Fetch OHLC price bars for a symbol (resolution, range, maxBars, priceField)

### Assessments

- `client.assessments.get(params)` — Fetch PnL assessments for a date range

## Enums

```ts
import { ORDER_TYPE, SIDE, ACTION, TIF } from "dxtrade-api";

ORDER_TYPE.MARKET | ORDER_TYPE.LIMIT | ORDER_TYPE.STOP
SIDE.BUY | SIDE.SELL
ACTION.OPENING | ACTION.CLOSING
TIF.GTC | TIF.DAY | TIF.GTD
```

## Callbacks

```ts
const client = new DxtradeClient({
  // ...
  callbacks: {
    onLogin: () => console.log("Logged in"),
    onAccountSwitch: (id) => console.log(`Switched to ${id}`),
    onOrderPlaced: (order) => console.log("Order placed", order),
    onOrderUpdate: (update) => console.log("Order update", update),
    onError: (err) => console.error(`[${err.code}] ${err.message}`),
  },
});
```

## Examples

```bash
cp .env.example .env  # fill in credentials
npm run example:connect
npm run example:debug
npm run example:positions:get
npm run example:positions:close
npm run example:positions:close-all
npm run example:positions:metrics
npm run example:positions:stream
npm run example:orders:submit
npm run example:account:metrics
npm run example:account:trade-journal
npm run example:account:trade-history
npm run example:symbols:info
npm run example:symbols:info:btc
npm run example:instruments:get
npm run example:instruments:get:forex
npm run example:ohlc:get
npm run example:assessments:get
npm run example:assessments:get:btc
```

## DXtrade API Docs

https://demo.dx.trade/developers/#/

## License

MIT
