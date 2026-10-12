// A self-hosted x402 facilitator for the class (Base Sepolia, "exact" scheme only).
// The public facilitator settles from one shared wallet and fails under concurrent load,
// so for a full classroom run this instead and give students its URL as FACILITATOR_URL.
//
// Usage: npm run facilitator   (needs FACILITATOR_PRIVATE_KEY with a little Base Sepolia ETH for gas;
//        set RPC_URL to one or more comma-separated endpoints, the public default rate-limits)
import express from "express";
import { createWalletClient, publicActions, nonceManager } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { NETWORK, publicUrl, transport } from "../config.js";

if (!process.env.FACILITATOR_PRIVATE_KEY) {
  console.error("Set FACILITATOR_PRIVATE_KEY in .instructor/.env");
  process.exit(1);
}
const PORT = Number(process.env.FACILITATOR_PORT || 4022);

// The nonce manager hands out nonces locally, so concurrent settlements do not collide.
const account = privateKeyToAccount(process.env.FACILITATOR_PRIVATE_KEY, { nonceManager });
const viem = createWalletClient({ account, chain: baseSepolia, transport }).extend(publicActions);

const signer = toFacilitatorEvmSigner({
  address: account.address,
  getCode: (args) => viem.getCode(args),
  readContract: (args) => viem.readContract({ ...args, args: args.args || [] }),
  verifyTypedData: (args) => viem.verifyTypedData(args),
  writeContract: (args) => viem.writeContract({ ...args, args: args.args || [] }),
  sendTransaction: (args) => viem.sendTransaction(args),
  waitForTransactionReceipt: (args) => viem.waitForTransactionReceipt(args),
});

const facilitator = new x402Facilitator()
  .register(NETWORK, new ExactEvmScheme(signer, { eip6492AllowedFactories: [] }))
  .onSettleFailure(async ({ error }) => console.warn("settle failed:", error?.message?.split("\n")[0]));

const app = express();
app.use(express.json());

const handle = (fn) => async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body || {};
  if (!paymentPayload || !paymentRequirements) return res.status(400).json({ error: "Missing paymentPayload or paymentRequirements" });
  try {
    res.json(await fn(paymentPayload, paymentRequirements));
  } catch (e) {
    if (e.message?.includes("Settlement aborted:")) {
      return res.json({ success: false, errorReason: e.message.replace("Settlement aborted: ", ""), network: paymentPayload.network });
    }
    res.status(500).json({ error: e.message });
  }
};
let settled = 0;
app.post("/verify", handle((p, r) => facilitator.verify(p, r)));
app.post("/settle", handle(async (p, r) => {
  const result = await facilitator.settle(p, r);
  if (result.success) console.log(`settled #${++settled} ${result.transaction}`);
  return result;
}));
app.get("/supported", (req, res) => res.json(facilitator.getSupported()));

app.listen(PORT, () => console.log(`Facilitator on ${publicUrl(PORT)}, paying gas from ${account.address}`));
