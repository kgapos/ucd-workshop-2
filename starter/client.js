// A client for x402 APIs. As-is it uses plain fetch, so a paid endpoint just answers 402.
// Your job is to make it pay and retry automatically.
// Usage: npm run client -- [url]
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { account, EXPLORER, PORT } from "../config.js";

const url = process.argv[2] || `http://localhost:${PORT}/fortune`;

// TODO 2.1: create an x402Client and register an ExactEvmScheme that signs with account(),
// for every EVM network ("eip155:*").

// TODO 2.2: wrap the built-in fetch with wrapFetchWithPayment(fetch, yourClient)
// and use the wrapped version below instead of plain fetch.
const res = await fetch(url);

console.log(`${res.status} ${res.statusText}`);
console.log(await res.text());

// The server explains what it wants in the PAYMENT-REQUIRED header (base64-encoded JSON).
const required = res.headers.get("PAYMENT-REQUIRED");
if (required) console.log("\nPayment required:", JSON.stringify(JSON.parse(atob(required)), null, 2));

// TODO 2.3: after a successful payment the server sends a PAYMENT-RESPONSE header.
// Decode it with decodePaymentResponseHeader() and print `${EXPLORER}/tx/${receipt.transaction}`.
