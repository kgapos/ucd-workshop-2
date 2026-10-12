// Creates a fresh testnet wallet and saves its private key to .env.
// Usage: npm run wallet  (instructors: npm run wallet -- FUNDER_PRIVATE_KEY .instructor/.env)
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const [name = "PRIVATE_KEY", file = ".env"] = process.argv.slice(2);
const env = existsSync(file) ? readFileSync(file, "utf8") : "";
let key = env.match(new RegExp(`^${name}=(0x[0-9a-fA-F]{64})$`, "m"))?.[1];

if (key) {
  console.log(`A wallet already exists in ${file}, keeping it.`);
} else {
  key = generatePrivateKey();
  appendFileSync(file, `${env && !env.endsWith("\n") ? "\n" : ""}${name}=${key}\n`);
  console.log(`New wallet saved to ${file} (testnet only, never reuse this key).`);
}
console.log(`\nYour address: ${privateKeyToAccount(key).address}\n`);
