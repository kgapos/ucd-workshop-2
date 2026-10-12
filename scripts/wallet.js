// Creates a fresh testnet wallet and saves its private key to .env.
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
let key = env.match(/^PRIVATE_KEY=(0x[0-9a-fA-F]{64})$/m)?.[1];

if (key) {
  console.log("A wallet already exists in .env, keeping it.");
} else {
  key = generatePrivateKey();
  appendFileSync(".env", `${env && !env.endsWith("\n") ? "\n" : ""}PRIVATE_KEY=${key}\n`);
  console.log("New wallet saved to .env (testnet only, never reuse this key).");
}
console.log(`\nYour address: ${privateKeyToAccount(key).address}\n`);
