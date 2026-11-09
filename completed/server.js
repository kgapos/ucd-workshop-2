// Reference solution: an Express API with free and paid (x402) endpoints.
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { account, NETWORK, FACILITATOR_URL, PORT, publicUrl } from "../config.js";

const name = process.env.NAME || process.env.GITHUB_USER || "anonymous";
const payTo = account().address; // payments go to your own wallet

const fortunes = [
  "A smart contract is only as smart as its author.",
  "You will find a bug in production. It will be yours.",
  "The block you seek is already finalised.",
  "Not your keys, not your fortune cookie.",
  "Today is a good day to read the whitepaper.",
];
const pick = () => fortunes[Math.floor(Math.random() * fortunes.length)];

// Part 2: which routes cost money, how much, and who gets paid.
const paidRoutes = {
  "GET /fortune": {
    accepts: { scheme: "exact", price: "$0.001", network: NETWORK, payTo },
    description: "One fortune cookie",
    mimeType: "application/json",
  },
  "GET /surge": {
    accepts: { scheme: "exact", price: (ctx) => surgePrice(ctx), network: NETWORK, payTo },
    description: "One fortune, pricier the busier this API is",
    mimeType: "application/json",
  },
};

// Challenge 9: surge pricing. The price function runs twice per purchase: once for the 402, and again
// when the paid retry arrives. The server then checks that what the client signed matches the price it
// computes now, so if traffic moved in between, the payment is rejected. The fix: remember every price we
// quoted for a short while, and on the paid retry honour the quote the client signed instead of re-pricing.
const QUOTE_TTL = 60_000;
const recent = []; // timestamps of unpaid /surge requests, our measure of "busy"
const quotes = new Map(); // price in USDC base units -> when that quote expires
function surgePrice({ paymentHeader }) {
  const now = Date.now();
  for (const [units, expires] of quotes) if (expires < now) quotes.delete(units);
  if (paymentHeader) {
    const signed = Number(decodePaymentSignatureHeader(paymentHeader).accepted?.amount);
    // ponytail: any live quote is accepted, so a buyer can reuse a cheaper one for up to QUOTE_TTL.
    // Key quotes by a nonce echoed in the request if that matters.
    if (quotes.has(signed)) return `$${(signed / 1e6).toFixed(6)}`;
  }
  while (recent.length && recent[0] < now - QUOTE_TTL) recent.shift();
  recent.push(now);
  const units = 1000 + 100 * (recent.length - 1); // $0.001, plus $0.0001 per request in the last minute
  quotes.set(units, now + QUOTE_TTL);
  return `$${(units / 1e6).toFixed(6)}`;
}

const app = express();
app.set("trust proxy", true); // Codespaces sits behind a proxy

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());
app.use(paymentMiddleware(paidRoutes, resourceServer));

// Free: describes this API so classmates (and agents) know what is on offer.
app.get("/", (req, res) => {
  res.json({
    name,
    payTo,
    endpoints: Object.entries(paidRoutes).map(([route, cfg]) => ({
      route,
      price: typeof cfg.accepts.price === "function" ? "dynamic" : cfg.accepts.price,
      description: cfg.description,
    })),
  });
});

app.get("/hello", (req, res) => res.json({ message: `Hello from ${name}, this one is free.` }));
app.get("/fortune", (req, res) => res.json({ fortune: pick(), from: name }));
app.get("/surge", (req, res) => res.json({ fortune: pick(), from: name, surge: true }));

app.listen(PORT, () => {
  console.log(`API for ${name} listening on port ${PORT}`);
  console.log(`Public URL: ${publicUrl()}`);
  console.log(`Payments go to ${payTo}`);
});
