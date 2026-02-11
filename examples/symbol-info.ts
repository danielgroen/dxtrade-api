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

  const query = process.argv[2] ?? "EURUSD";
  const suggestions = await client.getSymbolSuggestions(query);
  console.log("suggestions", suggestions);
  console.log("\n===================================\n");

  const symbol = suggestions[0];
  const info = await client.getSymbolInfo(symbol.name);
  console.log("info", info);
  console.log("\n===================================\n");

  const symbolLimits = await client.getSymbolLimits();
  console.log("symbolLimits: ", "[\n", symbolLimits[0], `\n...and ${symbolLimits.length - 1} more`, "\n]");
})().catch(console.error);
