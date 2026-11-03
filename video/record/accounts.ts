// Makes the demo video's two test accounts (Aichen, the host, and Mira, the friend) in the local
// server's database through the server's own account module, so no sign-up code is mailed: the
// addresses are example.com ones. An account that already exists is left as it is.
//
//   npx tsx video/record/accounts.ts
import { Accounts } from "../../apps/server/src/accounts";
import { openDb } from "../../apps/server/src/db";

export const DEMO_ACCOUNTS = [
  { email: "aichen@example.com", name: "Aichen", password: "game-night-demo" },
  { email: "mira@example.com", name: "Mira", password: "game-night-demo" },
];

const accounts = new Accounts(openDb());
for (const account of DEMO_ACCOUNTS) {
  try {
    const user = await accounts.signUp(account);
    console.log(`made ${user.name}`);
  } catch (err) {
    console.log(`${account.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
