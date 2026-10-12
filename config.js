// Shared settings for every script in this repo.
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export const NETWORK = "eip155:84532"; // Base Sepolia, in CAIP-2 format
export const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Circle's USDC on Base Sepolia
export const EXPLORER = "https://sepolia.basescan.org";
export const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402.org/facilitator";
export const PORT = Number(process.env.PORT || 4021);

export const publicClient = createPublicClient({ chain: baseSepolia, transport: http(process.env.RPC_URL) });

export function account() {
  if (!process.env.PRIVATE_KEY) {
    console.error("No PRIVATE_KEY in .env. Run `npm run wallet` first.");
    process.exit(1);
  }
  return privateKeyToAccount(process.env.PRIVATE_KEY);
}

// The URL classmates use to reach your server. In Codespaces it is derived from the codespace name.
export function publicUrl(port = PORT) {
  const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: domain } = process.env;
  return CODESPACE_NAME ? `https://${CODESPACE_NAME}-${port}.${domain}` : `http://localhost:${port}`;
}
