// Your API. It runs as-is with every endpoint free. Your job is to put a price on /fortune.
// Run it with `npm run server` (it restarts by itself when you save this file).
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { account, NETWORK, FACILITATOR_URL, PORT, publicUrl } from "../config.js";

const name = process.env.NAME || process.env.GITHUB_USER || "anonymous";
const payTo = account().address; // payments go to your own wallet

// TODO 3.1: make these yours. Jokes, haiku, ASCII art, a random number, a weather report for Dublin...
const fortunes = [
  "A smart contract is only as smart as its author.",
  "You will find a bug in production. It will be yours.",
  "Not your keys, not your fortune cookie.",
];
const pick = () => fortunes[Math.floor(Math.random() * fortunes.length)];

// TODO 1.1: describe which routes cost money. Each key is "METHOD /path", and each value says
// how this route can be paid for:
//   accepts: { scheme: "exact", price: "$0.001", network: NETWORK, payTo }
// plus an optional description and mimeType (shown to the client in the 402 response).
const paidRoutes = {};

const app = express();
app.set("trust proxy", true); // Codespaces sits behind a proxy

// TODO 1.2: protect the routes above.
//  a) Create an HTTPFacilitatorClient that talks to FACILITATOR_URL.
//  b) Create an x402ResourceServer that uses it, and register the ExactEvmScheme for NETWORK.
//  c) app.use(paymentMiddleware(paidRoutes, yourResourceServer));
// The middleware must be added before the routes it protects.

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

app.listen(PORT, () => {
  console.log(`API for ${name} listening on port ${PORT}`);
  console.log(`Public URL: ${publicUrl()}`);
  console.log(`Payments go to ${payTo}`);
});
