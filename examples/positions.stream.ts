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
  console.log("Connected — streaming positions...\n");

  const unsubscribe = client.positions.stream((positions) => {
    console.log("Positions: ", positions);
    console.log();
  });

  // Stream for 60 seconds then clean up
  setTimeout(() => {
    console.log("Unsubscribing and disconnecting...");
    unsubscribe();
    client.disconnect();
  }, 60_000);
})().catch(console.error);
