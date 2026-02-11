import "dotenv/config";
import { DxtradeClient } from "../src";

const client = new DxtradeClient({
  username: process.env.DXTRADE_USERNAME!,
  password: process.env.DXTRADE_PASSWORD!,
  broker: process.env.DXTRADE_BROKER!,
  accountId: process.env.DXTRADE_ACCOUNT_ID,
  debug: process.env.DXTRADE_DEBUG || false,
  callbacks: {
    onLogin: () => console.log("Logged in"),
    onAccountSwitch: (id: string) => console.log(`Switched to account ${id}`),
    onError: (err: any) => console.error(`Error [${err.code}]: ${err.message}`),
  },
});

async function main() {
  await client.connect();
  console.log("Connected successfully");
}

main().catch(console.error);
