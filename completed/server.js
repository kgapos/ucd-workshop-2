// Reference solution: an Express API with free and paid (x402) endpoints.
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { account, NETWORK, FACILITATOR_URL, PORT, publicUrl, EURC } from "../config.js";

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
  // Challenge 11: /fortune takes USDC or EURC. Prices in "$" always mean USDC, so EURC is given as a raw
  // amount (6 decimals, so 1000 = 0.001 EURC) plus the token's EIP-712 domain, which the payer signs over.
  "GET /fortune": {
    accepts: [
      { scheme: "exact", price: "$0.001", network: NETWORK, payTo },
      { scheme: "exact", price: { amount: "1000", asset: EURC, extra: { name: "EURC", version: "2" } }, network: NETWORK, payTo },
    ],
    description: "One fortune cookie",
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
    endpoints: Object.entries(paidRoutes).map(([route, cfg]) => {
      const [first, ...others] = [cfg.accepts].flat(); // price stays the USDC one, so agents keep working
      return {
        route,
        price: typeof first.price === "function" ? "dynamic" : first.price,
        ...(others.length && { alsoAccepts: others.map((a) => (a.price.asset === EURC ? "EURC" : a.price.asset)) }),
        description: cfg.description,
      };
    }),
  });
});

app.get("/hello", (req, res) => res.json({ message: `Hello from ${name}, this one is free.` }));
app.get("/fortune", (req, res) => res.json({ fortune: pick(), from: name }));

app.listen(PORT, () => {
  console.log(`API for ${name} listening on port ${PORT}`);
  console.log(`Public URL: ${publicUrl()}`);
  console.log(`Payments go to ${payTo}`);
});
