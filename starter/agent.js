// Part 4 (stretch): an agent that decides which classmate APIs to pay for, using plain rules.
// Usage: npm run agent  (needs BOARD_URL in .env)
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { account } from "../config.js";

const me = account();
const board = process.env.BOARD_URL?.replace(/\/$/, "");
if (!board) {
  console.error("Set BOARD_URL in .env");
  process.exit(1);
}
const budget = Number(process.env.BUDGET || 0.02); // USDC this agent may spend

const fetchWithPayment = wrapFetchWithPayment(fetch, new x402Client().register("eip155:*", new ExactEvmScheme(me)));

// 1. Observe: the board lists every API, with `up`, `url` and `address`.
const apis = await (await fetch(`${board}/apis.json`)).json();
console.log(`${apis.filter((a) => a.up).length} of ${apis.length} APIs are up`);

// Every API answers GET / for free with { name, payTo, endpoints: [{ route, price, description }] }.
// TODO 4.1: collect all offers (url + price) from the APIs that are up. Skip your own.

// TODO 4.2: decide what to buy. Some ideas for rules:
//   cheapest first, one purchase per seller, never pay more than $0.005, prefer APIs with fewer paid requests...

// TODO 4.3: buy with fetchWithPayment() until the budget runs out, and print what you got.
