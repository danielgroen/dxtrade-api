import "dotenv/config";
import { DxtradeClient } from "../src";

const client = new DxtradeClient({
  username: process.env.DXTRADE_USERNAME!,
  password: process.env.DXTRADE_PASSWORD!,
  broker: process.env.DXTRADE_BROKER!,
  accountId: process.env.DXTRADE_ACCOUNT_ID,
  debug: process.env.DXTRADE_DEBUG || false,
});

(async () => {
  await client.connect();
  console.log("Connected — fetching instruments\n");

  // Get all instruments
  const instruments = await client.getInstruments();
  console.log("[\n", instruments[0], `\n...and ${instruments.length - 1} more`, "\n]");

  console.log("\n===================================\n");

  // Get filtered instruments
  const instrumentFiltered = await client.getInstruments({ symbol: "BTCUSD" });
  console.log("instrumentFiltered: ", instrumentFiltered);
})().catch(console.error);
