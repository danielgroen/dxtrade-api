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
  await client.auth();

  const positions = await client.positions.get();
  if (positions.length === 0) {
    console.log("No open positions to close");
    return;
  }

  const position = positions[0];
  const code = position.positionKey.positionCode;
  console.log(`Closing position ${code}...`);

  const closed = await client.positions.close(code);
  console.log("Position closed:", closed);
})().catch(console.error);
