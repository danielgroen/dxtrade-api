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
  await client.connect();

  const suggestions = await client.symbols.search("ETHUSD");
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
  console.log(`Order filled: ${order.orderId} — positionCode: ${order.positionCode}`);

  // 2. Wait 3 seconds for P&L to update
  console.log("\nWaiting 3 seconds...");
  await sleep(3000);

  // 3. Close the position by its code and wait for confirmation via streaming
  console.log("Closing position by code (waiting for close confirmation)...");
  const position = await client.positions.close(order.positionCode!, { waitForClose: "stream" });

  console.log("\nPosition closed:");
  console.log(`  P&L Open:      ${position.plOpen}`);
  console.log(`  P&L Closed:    ${position.plClosed}`);
  console.log(`  Commissions:   ${position.totalCommissions}`);
  console.log(`  Financing:     ${position.totalFinancing}`);
  console.log(`  Market Value:  ${position.marketValue}`);

  client.disconnect();
})().catch(console.error);
