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

  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const assessments = await client.getAssessments({
    from: oneWeekAgo,
    to: now,
    instrument: "EURUSD",
  });

  console.log("Assessments:", assessments);
})().catch(console.error);
