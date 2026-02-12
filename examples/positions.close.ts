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
  // TODO:: improve parameters! maybe even have a "closeWholePosition" function

  const positions = await client.positions.close({
    legs: [
      {
        instrumentId: 3438,
        positionCode: "191361108",
        positionEffect: "CLOSING",
        ratioQuantity: 1,
        symbol: "EURUSD",
      },
    ],
    limitPrice: 1.18725,
    orderType: "MARKET",
    quantity: -1000,
    timeInForce: "GTC",
  });

  console.log("Positions: ", positions);
})().catch(console.error);
