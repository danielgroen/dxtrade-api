import "dotenv/config";
import { DxtradeClient, ORDER_TYPE, SIDE } from "../src";

const client = new DxtradeClient({
  username: process.env.DXTRADE_USERNAME!,
  password: process.env.DXTRADE_PASSWORD!,
  broker: process.env.DXTRADE_BROKER!,
  accountId: process.env.DXTRADE_ACCOUNT_ID,
  debug: process.env.DXTRADE_DEBUG === "true",
});

async function main() {
  await client.connect();
  console.log("Connected");

  const suggestions = await client.getSymbolSuggestions("EURUSD");
  const symbol = suggestions[0];
  console.log(`Found symbol: ${symbol.name} (id: ${symbol.id})`);

  const info = await client.getSymbolInfo(symbol.name);
  console.log(`Min volume: ${info.minVolume}, Lot size: ${info.lotSize}`);

  const order = await client.submitOrder({
    symbol: symbol.name,
    side: SIDE.BUY,
    quantity: info.minVolume,
    orderType: ORDER_TYPE.MARKET,
    instrumentId: symbol.id,
  });

  console.log(`Order filled: ${order.orderId} — status: ${order.status}`);
}

main().catch(console.error);
