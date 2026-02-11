import "dotenv/config";
import { DxtradeClient } from "../src";

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

  const query = process.argv[2] ?? "EURUSD";
  const suggestions = await client.getSymbolSuggestions(query);
  const symbol = suggestions[0];
  const info = await client.getSymbolInfo(symbol.name);

  console.log("suggestions", suggestions);
  console.log("info", info);
  console.log("symbol", symbol);
}

main().catch(console.error);
