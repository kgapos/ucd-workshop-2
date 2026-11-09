// Reference solution: a client that pays for x402-protected endpoints automatically.
// Usage: node --env-file=.env completed/client.js [url]
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { formatUnits } from "viem";
import { account, EXPLORER, PORT } from "../config.js";

const url = process.argv[2] || `http://localhost:${PORT}/fortune`;

// Part 3: register how we can pay (any EVM network, signed with our wallet).
const client = new x402Client().register("eip155:*", new ExactEvmScheme(account()));

// Challenge 7: a spending cap. Refuse to sign once this run has spent BUDGET USDC.
const budget = Number(process.env.BUDGET || 0.05) * 1e6; // in USDC base units (6 decimals)
let spent = 0;
client.onBeforePaymentCreation(async ({ selectedRequirements: req }) => {
  if (spent + Number(req.amount) > budget) return { abort: true, reason: `budget of ${budget / 1e6} USDC reached` };
});
client.onAfterPaymentCreation(async ({ selectedRequirements: req }) => {
  spent += Number(req.amount);
});

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

let res;
try {
  res = await fetchWithPayment(url);
} catch (e) {
  console.error(`Did not pay: ${e.message}`); // e.g. the budget cap above, or no USDC left
  process.exit(1);
}
console.log(`${res.status} ${res.statusText}`);
console.log(await res.text());

// The server reports the settlement result in the PAYMENT-RESPONSE header.
const header = res.headers.get("PAYMENT-RESPONSE");
if (header) {
  const receipt = decodePaymentResponseHeader(header);
  if (receipt.success) {
    console.log(`\nPaid ${formatUnits(BigInt(spent), 6)} USDC`);
    console.log(`Transaction: ${EXPLORER}/tx/${receipt.transaction}`);
  } else {
    console.log(`\nPayment failed: ${receipt.errorReason} ${receipt.errorMessage || ""}`);
  }
}
