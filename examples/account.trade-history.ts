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

  const from = new Date(new Date().setMonth(new Date().getMonth() - 1)).getTime();
  const to = Date.now();

  const history = await client.account.tradeHistory({ from, to });

  console.log("Trade history:", history);
})().catch(console.error);
