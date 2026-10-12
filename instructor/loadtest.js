// Load test for the paid flow (402 -> sign -> verify -> settle), to see how the facilitator copes with a class.
// Every successful request is a real testnet payment, so the cost is requests x price.
//
// Usage: npm run loadtest -- <paid-url> [--requests 40] [--concurrency 10]
//   e.g. npm run loadtest -- http://localhost:4021/fortune --requests 100 --concurrency 20
// Pays from PRIVATE_KEY in .env (or LOADTEST_PRIVATE_KEY).
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { account } from "../config.js";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const url = process.argv[2];
if (!url?.startsWith("http")) {
  console.error("Usage: npm run loadtest -- <paid-url> [--requests 40] [--concurrency 10]");
  process.exit(1);
}
const total = arg("requests", 40);
const concurrency = arg("concurrency", 10);

const payer = process.env.LOADTEST_PRIVATE_KEY ? privateKeyToAccount(process.env.LOADTEST_PRIVATE_KEY) : account();
const fetchWithPayment = wrapFetchWithPayment(fetch, new x402Client().register("eip155:*", new ExactEvmScheme(payer)));

const results = [];
let next = 0;
const started = Date.now();
async function worker() {
  while (next < total) {
    const id = next++;
    const t = Date.now();
    let outcome;
    try {
      const res = await fetchWithPayment(url);
      const err = res.headers.get("PAYMENT-REQUIRED") && JSON.parse(atob(res.headers.get("PAYMENT-REQUIRED"))).error;
      outcome = res.ok ? `${res.status}` : `${res.status} ${err || (await res.text()).slice(0, 80)}`;
    } catch (e) {
      outcome = `error ${e.message.slice(0, 80)}`;
    }
    results.push({ ms: Date.now() - t, outcome });
    process.stdout.write(`\r${results.length}/${total} done`);
  }
}
console.log(`${total} paid requests to ${url}, ${concurrency} at a time, paying from ${payer.address}`);
await Promise.all(Array.from({ length: concurrency }, worker));

const secs = (Date.now() - started) / 1000;
const ms = results.map((r) => r.ms).sort((a, b) => a - b);
const pct = (p) => ms[Math.min(ms.length - 1, Math.floor((p / 100) * ms.length))];
const outcomes = Object.entries(Object.groupBy(results, (r) => r.outcome)).sort((a, b) => b[1].length - a[1].length);
console.log(`\n\nFinished in ${secs.toFixed(1)}s (${(total / secs).toFixed(2)} req/s)`);
console.log(`Latency ms: p50 ${pct(50)}  p95 ${pct(95)}  max ${ms.at(-1)}`);
for (const [outcome, list] of outcomes) console.log(`  ${String(list.length).padStart(5)} x ${outcome}`);
process.exit(results.every((r) => r.outcome === "200") ? 0 : 1);
