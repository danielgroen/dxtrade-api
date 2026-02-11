# DXtrade API

<!-- create image from ./public/logo-dxtrade.svg -->
[![DXtrade API](https://raw.githubusercontent.com/danielgroen/dxtrade-api/master/public/logo-dxtrade.svg)](https://demo.dx.trade/developers/#/)

TypeScript client library for the DXtrade trading API based upon Nodejs.

## Install

```bash
npm install dxtrade-api
```

## Quick Start

```ts
import { DxtradeClient, OrderType, OrderSide, BROKER } from "dxtrade-api";

const client = new DxtradeClient({
  username: "your_username",
  password: "your_password",
  broker: "larkfunding",
  accountId: "optional_account_id",
});

await client.connect();

const suggestions = await client.getSymbolSuggestions("EURUSD");
const symbol = suggestions[0];

const order = await client.submitOrder({
  symbol: symbol.name,
  side: OrderSide.BUY,
  quantity: 0.01,
  orderType: OrderType.MARKET,
  instrumentId: symbol.id,
});

console.log(`Order ${order.orderId}: ${order.status}`);
```

## Configuration

| Option | Type | Required | Description |
|---|---|---|---|
| `username` | `string` | Yes | DXtrade account username |
| `password` | `string` | Yes | DXtrade account password |
| `broker` | `string` | Yes | Broker identifier (e.g. `"larkfunding"`, `"eightcap"`) |
| `accountId` | `string` | No | Account ID to auto-switch after login |
| `brokerUrls` | `Record<string, string>` | No | Custom broker URL mapping |
| `retries` | `number` | No | Retry count for failed requests (default: 3) |
| `callbacks` | `DxtradeCallbacks` | No | Event callbacks |

## Built-in Brokers

```ts
import { BROKER } from "dxtrade-api";

BROKER.LARK      // "https://trade.gooeytrade.com"
BROKER.EIGHTCAP  // "https://trader.dx-eightcap.com"
BROKER.FTMO      // "https://trade.dx-ftmo.com"
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

### Trading

- `client.submitOrder(params)` — Submit an order and wait for WebSocket confirmation

### Analytics

- `client.getAssessments(params)` — Fetch PnL assessments for a date range

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
```

## DXtrade API Docs

https://demo.dx.trade/developers/#/

## License

MIT
