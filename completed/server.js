// Reference solution: an Express API with free and paid (x402) endpoints.
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
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
// Challenge 5: a second paid route at a different price (/premium).
const paidRoutes = {
  "GET /fortune": {
    accepts: { scheme: "exact", price: "$0.001", network: NETWORK, payTo },
    description: "One fortune cookie",
    mimeType: "application/json",
  },
  "GET /premium": {
    accepts: { scheme: "exact", price: "$0.01", network: NETWORK, payTo },
    description: "A hand-picked fortune, ten times the price",
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
app.get("/premium", (req, res) => res.json({ fortune: fortunes[3], from: name, premium: true }));

app.listen(PORT, () => {
  console.log(`API for ${name} listening on port ${PORT}`);
  console.log(`Public URL: ${publicUrl()}`);
  console.log(`Payments go to ${payTo}`);
});
