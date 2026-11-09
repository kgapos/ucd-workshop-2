// Reference solution: a client that pays for x402-protected endpoints automatically.
// Usage: node --env-file=.env completed/client.js [url]
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { account, EXPLORER, PORT, NETWORK, EURC } from "../config.js";

const url = process.argv[2] || `http://localhost:${PORT}/fortune`;

// Challenge 11: by default the client pays the first option the server offers. PAY_WITH=EURC picks EURC
// instead whenever the server accepts it.
const want = process.env.PAY_WITH === "EURC" ? EURC.toLowerCase() : null;
const pickOption = (version, options) => options.find((o) => o.asset.toLowerCase() === want) || options[0];

// Part 3: register how we can pay (any EVM network, signed with our wallet).
const client = new x402Client(pickOption).register("eip155:*", new ExactEvmScheme(account()));
// Challenge 11: the client only signs for assets it knows (USDC here). Without this line it silently drops
// the EURC option and pays in USDC.
client.setSpendControls({ allowedAssets: [{ network: NETWORK, asset: EURC }] });
let paidIn;
client.onAfterPaymentCreation(async ({ selectedRequirements: req }) => {
  paidIn = req.asset.toLowerCase() === EURC.toLowerCase() ? "EURC" : "USDC";
});

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

let res;
try {
  res = await fetchWithPayment(url);
} catch (e) {
  console.error(`Did not pay: ${e.message}`); // e.g. no USDC left
  process.exit(1);
}
console.log(`${res.status} ${res.statusText}`);
console.log(await res.text());

// The server reports the settlement result in the PAYMENT-RESPONSE header.
const header = res.headers.get("PAYMENT-RESPONSE");
if (header) {
  const receipt = decodePaymentResponseHeader(header);
  if (receipt.success) {
    console.log(`\nPaid in ${paidIn}`);
    console.log(`Transaction: ${EXPLORER}/tx/${receipt.transaction}`);
  } else {
    console.log(`\nPayment failed: ${receipt.errorReason} ${receipt.errorMessage || ""}`);
  }
}
