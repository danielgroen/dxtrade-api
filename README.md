# DXtrade API

[![npm version](https://img.shields.io/npm/v/@danielgroen/dxtrade-api)](https://www.npmjs.com/package/@danielgroen/dxtrade-api)
[![npm downloads](https://img.shields.io/npm/dm/@danielgroen/dxtrade-api)](https://www.npmjs.com/package/@danielgroen/dxtrade-api)
[![license](https://img.shields.io/npm/l/@danielgroen/dxtrade-api)](LICENSE)
[![Publish to npm](https://github.com/danielgroen/dxtrade-api/actions/workflows/publish.yml/badge.svg)](https://github.com/danielgroen/dxtrade-api/actions/workflows/publish.yml)

[![DXtrade API](https://raw.githubusercontent.com/danielgroen/dxtrade-api/master/public/logo-dxtrade.svg)](https://demo.dx.trade/developers/#/)

TypeScript client library for the DXtrade trading API based upon Nodejs.

## Install

```bash
npm install dxtrade-api
```

## Quick Start

```ts
import { DxtradeClient, ORDER_TYPE, SIDE, BROKER } from "dxtrade-api";

const client = new DxtradeClient({
  username: "your_username",
  password: "your_password",
  broker: "LARKFUNDING",
  accountId: "optional_account_id",
});

await client.connect();

const suggestions = await client.getSymbolSuggestions("EURUSD");
const symbol = suggestions[0];

const order = await client.submitOrder({
  symbol: symbol.name,
  side: SIDE.BUY,
  quantity: 0.01,
  orderType: ORDER_TYPE.MARKET,
  instrumentId: symbol.id,
});

console.log(`Order ${order.orderId}: ${order.status}`);
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

- `client.connect()` — Login, fetch CSRF, WebSocket handshake, optional account switch
- `client.login()` — Authenticate with broker
- `client.fetchCsrf()` — Fetch CSRF token from broker page
- `client.switchAccount(accountId)` — Switch to a specific account

### Market Data

- `client.getSymbolSuggestions(text)` — Search for symbols
- `client.getSymbolInfo(symbol)` — Get instrument info (volume limits, lot size)
- `client.getSymbolLimits()` — Get order size limits and stop/limit distances for all symbols
- `client.getInstruments(params?)` — Get all available instruments, optionally filtered by partial match (e.g. `{ type: "FOREX" }`)

### Trading

- `client.submitOrder(params)` — Submit an order and wait for WebSocket confirmation

### Account

- `client.getAccountMetrics()` — Get account metrics (equity, balance, margin, open P&L, etc.)
- `client.getTradeJournal({ from, to })` — Fetch trade journal entries for a date range (Unix timestamps)

### Analytics

- `client.getAssessments(params)` — Fetch PnL assessments for a date range

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
npm run example:order
npm run example:assessments
npm run example:account
npm run example:instruments
npm run example:instruments:forex
npm run example:symbol
npm run example:symbol:btc
npm run example:trade-journal
npm run example:debug
```

## DXtrade API Docs

https://demo.dx.trade/developers/#/

## License

MIT
