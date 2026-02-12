import "dotenv/config";
import { DxtradeClient, ORDER_TYPE, SIDE, BROKER } from "../src";

const client = new DxtradeClient({
  username: process.env.DXTRADE_USERNAME!,
  password: process.env.DXTRADE_PASSWORD!,
  broker: process.env.DXTRADE_BROKER! || BROKER.FTMO,
  accountId: process.env.DXTRADE_ACCOUNT_ID,
  debug: process.env.DXTRADE_DEBUG || false,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  await client.auth();

  const suggestions = await client.symbols.search("EURUSD");
  const symbol = suggestions[0];
  console.log(`Found symbol: ${symbol.name} (id: ${symbol.id})`);

  const info = await client.symbols.info(symbol.name);
  console.log(`Min volume: ${info.minVolume}, Lot size: ${info.lotSize}`);

  // 1. Submit a market order
  const order = await client.orders.submit({
    symbol: symbol.name,
    side: SIDE.BUY,
    quantity: info.minVolume,
    orderType: ORDER_TYPE.MARKET,
    instrumentId: symbol.id,
  });
  console.log(`Order filled: ${order.orderId} — status: ${order.status}`);

  // 2. Wait 2 seconds, then close the position
  await sleep(2000);
  console.log("\nClosing position...");
  await client.positions.closeAll();
  console.log("All positions closed");

  // 3. Wait 2 seconds, then submit a limit order and immediately cancel it
  await sleep(2000);
  console.log("\nPlacing limit order...");
  const limitOrder = await client.orders.submit({
    symbol: symbol.name,
    side: SIDE.BUY,
    quantity: info.minVolume,
    orderType: ORDER_TYPE.LIMIT,
    price: 1.0,
    instrumentId: symbol.id,
  });
  console.log(`Limit order placed: ${limitOrder.orderId} — status: ${limitOrder.status}`);

  console.log("Cancelling order...");
  await client.orders.cancelAll();
  console.log("All orders cancelled");
})().catch(console.error);
