// Reference solution: an Express API with free and paid (x402) endpoints.
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactEvmScheme as ExactEvmClientScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
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

// Challenge 13: a reseller. /resold buys a fortune from UPSTREAM_URL (a classmate's paid route) with our own
// wallet, adds value, and sells it on at a markup. Our server is now a buyer and a seller at the same time.
const UPSTREAM_URL = process.env.UPSTREAM_URL; // e.g. https://<classmate>-4021.app.github.dev/fortune
const RESALE_PRICE = "$0.002";
const buyer = new x402Client().register("eip155:*", new ExactEvmClientScheme(account()));
// Never pay upstream as much as we charge, or every sale loses money.
buyer.onBeforePaymentCreation(async ({ selectedRequirements: req }) => {
  if (Number(req.amount) >= Number(RESALE_PRICE.slice(1)) * 1e6) return { abort: true, reason: "upstream too expensive" };
});
const buy = wrapFetchWithPayment(fetch, buyer);
const piratify = (text) =>
  "Arr! " + text.replace(/\byou\b/gi, "ye").replace(/\byour\b/gi, "yer").replace(/\bis\b/gi, "be").replace(/\.$/, ", matey!");

// Part 2: which routes cost money, how much, and who gets paid.
const paidRoutes = {
  "GET /fortune": {
    accepts: { scheme: "exact", price: "$0.001", network: NETWORK, payTo },
    description: "One fortune cookie",
    mimeType: "application/json",
  },
  "GET /resold": {
    accepts: { scheme: "exact", price: RESALE_PRICE, network: NETWORK, payTo },
    description: "A classmate's fortune, translated into pirate. Value added!",
    mimeType: "application/json",
  },
};

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
// The handler runs after the customer's payment is verified but before it settles. If it fails (an error
// status), the middleware cancels the settlement, so the customer is not charged when upstream is down.
// ponytail: if our own settlement fails after a successful upstream buy, we eat the upstream cost.
app.get("/resold", async (req, res) => {
  if (!UPSTREAM_URL) return res.status(503).json({ error: "Set UPSTREAM_URL in .env" });
  try {
    const upstream = await buy(UPSTREAM_URL, { signal: AbortSignal.timeout(20_000) });
    if (!upstream.ok) return res.status(502).json({ error: `upstream answered ${upstream.status}` });
    const { fortune, from } = await upstream.json();
    res.json({ fortune: piratify(fortune), from: name, sourcedFrom: from });
  } catch (e) {
    res.status(502).json({ error: `could not buy upstream: ${e.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`API for ${name} listening on port ${PORT}`);
  console.log(`Public URL: ${publicUrl()}`);
  console.log(`Payments go to ${payTo}`);
});
