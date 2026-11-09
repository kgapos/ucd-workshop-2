// Challenge 10 (TODOs 5.1 to 5.3): a rule-based agent that shops around the class.
// It reads the board, asks every API what it sells, and buys the cheapest thing from each one
// it has not bought from yet, until its budget runs out. No LLM needed, just rules.
// Usage: node --env-file=.env completed/agent.js  (needs BOARD_URL in .env; BUDGET in USDC, default 0.02)
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { account, EXPLORER } from "../config.js";

const me = account();
const board = process.env.BOARD_URL?.replace(/\/$/, "");
if (!board) {
  console.error("Set BOARD_URL in .env");
  process.exit(1);
}
let budget = Number(process.env.BUDGET || 0.02);

const client = new x402Client().register("eip155:*", new ExactEvmScheme(me));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const usd = (price) => Number(String(price).replace("$", ""));

// 1. Observe: who is up, and what do they sell?
const apis = await (await fetch(`${board}/apis.json`)).json();
const offers = [];
for (const api of apis.filter((a) => a.up && a.address !== me.address)) {
  try {
    const info = await (await fetch(api.url + "/", { signal: AbortSignal.timeout(4000) })).json();
    for (const e of info.endpoints || []) {
      const [method, path] = e.route.split(" ");
      if (method === "GET" && e.price !== "dynamic") offers.push({ seller: api.name, url: api.url + path, price: usd(e.price) });
    }
  } catch {
    console.log(`skip ${api.name}: no endpoint list`);
  }
}

// 2. Decide: the cheapest offer from each seller, cheapest sellers first.
const cheapest = Object.values(Object.groupBy(offers, (o) => o.seller)).map((list) => list.sort((a, b) => a.price - b.price)[0]);
cheapest.sort((a, b) => a.price - b.price);
console.log(`${cheapest.length} sellers found, budget ${budget} USDC\n`);

// 3. Act: buy while the budget lasts.
for (const offer of cheapest) {
  if (offer.price > budget) {
    console.log(`stop: ${offer.seller} costs ${offer.price}, only ${budget.toFixed(4)} left`);
    break;
  }
  try {
    const res = await fetchWithPayment(offer.url, { signal: AbortSignal.timeout(30_000) });
    const receipt = res.headers.get("PAYMENT-RESPONSE");
    if (!res.ok || !receipt) throw new Error(`HTTP ${res.status}`);
    budget -= offer.price;
    console.log(`bought ${offer.url} for ${offer.price}: ${(await res.text()).slice(0, 100)}`);
    console.log(`  ${EXPLORER}/tx/${decodePaymentResponseHeader(receipt).transaction}`);
  } catch (e) {
    console.log(`failed ${offer.url}: ${e.message}`);
  }
}
