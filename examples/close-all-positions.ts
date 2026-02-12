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

  const positions = await client.getPositions();
  console.log(`Closing ${positions.length} position(s)...`);

  await client.closeAllPositions();

  console.log("All positions closed");
})().catch(console.error);
