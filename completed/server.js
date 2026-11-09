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
const paidRoutes = {
  "GET /fortune": {
    accepts: { scheme: "exact", price: "$0.001", network: NETWORK, payTo },
    description: "One fortune cookie",
    mimeType: "application/json",
  },
};

const app = express();
app.set("trust proxy", true); // Codespaces sits behind a proxy

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());

// Challenge 4: count sales only once the payment has settled on-chain. The route handler runs
// before settlement, and a failed settlement turns the response into a 402, so counting there would lie.
// ponytail: in memory, resets on restart; persist it to a file if that matters.
const stats = { fortunesSold: 0, revenueUsdc: 0, byRoute: {} };
resourceServer.onAfterSettle(async ({ result, requirements, transportContext }) => {
  if (!result.success) return;
  const route = transportContext?.request?.path;
  stats.fortunesSold++;
  stats.revenueUsdc = Number((stats.revenueUsdc + Number(requirements.amount) / 1e6).toFixed(6));
  stats.byRoute[route] = (stats.byRoute[route] || 0) + 1;
});

app.use(paymentMiddleware(paidRoutes, resourceServer));

// Free: how business is going.
app.get("/stats", (req, res) => res.json(stats));

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
