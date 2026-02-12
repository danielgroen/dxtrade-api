import "dotenv/config";
import { DxtradeClient, BROKER } from "../src";

const client = new DxtradeClient({
  username: process.env.DXTRADE_USERNAME!,
  password: process.env.DXTRADE_PASSWORD!,
  broker: process.env.DXTRADE_BROKER! || BROKER.FTMO,
  accountId: process.env.DXTRADE_ACCOUNT_ID,
  debug: process.env.DXTRADE_DEBUG || false,
});

const symbol = process.argv[2] ?? "EURUSD";

(async () => {
  await client.connect();

  const bars = await client.getOHLC({ symbol });

  console.log("Last 5 bars:", "[\n", ...bars.slice(-5), `\n...and ${bars.length - 5} more`, "\n]");
  console.log(`Fetched ${bars.length} bars for ${symbol}`);
})().catch(console.error);
