// Tops up every student wallet with testnet USDC (and a little ETH) from the instructor's wallet.
// Safe to re-run: every successful transfer is recorded in instructor/funded.json and not repeated.
// (Balances alone are not enough: a load-balanced RPC can return a stale balance right after a transfer.)
//
// Usage: npm run fund -- <source> [--dry-run] [--topup]
//   --topup ignores funded.json and tops every wallet back up to the target, e.g. for a second session.
//   <source> is any file or URL containing addresses, e.g. the board (https://...-8080.app.github.dev/apis.json),
//   instructor/students.json, or a CSV exported from a form. Every 0x... address found in it is funded.
// Env (instructor/.env): FUNDER_PRIVATE_KEY, USDC_AMOUNT (default 1), ETH_AMOUNT (default 0.0005), BATCH (default 10)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createWalletClient, http, erc20Abi, getAddress, parseUnits, parseEther, formatUnits, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { publicClient, USDC, EXPLORER } from "../config.js";

const [source] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
const topup = process.argv.includes("--topup");
const LEDGER = new URL("funded.json", import.meta.url);
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : {}; // "address:kind" -> tx hash
if (!source) {
  console.error("Usage: npm run fund -- <file-or-url> [--dry-run] [--topup]");
  process.exit(1);
}
if (!process.env.FUNDER_PRIVATE_KEY) {
  console.error("Set FUNDER_PRIVATE_KEY in instructor/.env");
  process.exit(1);
}
const usdcTarget = parseUnits(process.env.USDC_AMOUNT || "1", 6);
const ethTarget = parseEther(process.env.ETH_AMOUNT || "0.0005");
const batchSize = Number(process.env.BATCH || 10);

const funder = privateKeyToAccount(process.env.FUNDER_PRIVATE_KEY);
const wallet = createWalletClient({ account: funder, chain: baseSepolia, transport: http(process.env.RPC_URL) });

const text = /^https?:/.test(source) ? await (await fetch(source)).text() : readFileSync(source, "utf8");
const addresses = [...new Set(text.match(/0x[0-9a-fA-F]{40}\b/g)?.map((a) => getAddress(a)) || [])].filter((a) => a !== funder.address);
console.log(`Found ${addresses.length} addresses in ${source}`);

// Work out who needs what.
const usdcOf = (address) => publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [address] });
const jobs = [];
for (const address of addresses) {
  const [usdc, eth] = await Promise.all([usdcOf(address), publicClient.getBalance({ address })]);
  if (usdc < usdcTarget && (topup || !ledger[`${address}:USDC`])) jobs.push({ address, kind: "USDC", amount: usdcTarget - usdc });
  if (eth < ethTarget && (topup || !ledger[`${address}:ETH`])) jobs.push({ address, kind: "ETH", amount: ethTarget - eth });
}
const need = (kind) => jobs.filter((j) => j.kind === kind).reduce((sum, j) => sum + j.amount, 0n);
const [haveUsdc, haveEth] = await Promise.all([usdcOf(funder.address), publicClient.getBalance({ address: funder.address })]);
console.log(`Funder ${funder.address}: ${formatUnits(haveUsdc, 6)} USDC, ${formatEther(haveEth)} ETH`);
console.log(`Needed: ${formatUnits(need("USDC"), 6)} USDC, ${formatEther(need("ETH"))} ETH plus gas, in ${jobs.length} transfers`);
for (const j of jobs) console.log(`  ${j.address}  +${j.kind === "USDC" ? formatUnits(j.amount, 6) : formatEther(j.amount)} ${j.kind}`);

if (dryRun || jobs.length === 0) process.exit(0);
if (haveUsdc < need("USDC") || haveEth < need("ETH")) {
  console.error("Funder balance too low. Top it up from a faucet or lower USDC_AMOUNT / ETH_AMOUNT.");
  process.exit(1);
}

const send = (job, nonce) =>
  job.kind === "USDC"
    ? wallet.writeContract({ address: USDC, abi: erc20Abi, functionName: "transfer", args: [job.address, job.amount], nonce })
    : wallet.sendTransaction({ to: job.address, value: job.amount, nonce });

async function withRetry(fn, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      console.warn(`  retry ${i}/${tries - 1}: ${e.shortMessage || e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

// Broadcast one batch with consecutive nonces, then wait for all of its receipts.
// If a broadcast keeps failing we stop, because a gap in nonces would block every later transfer.
const failed = [];
for (let i = 0; i < jobs.length; i += batchSize) {
  const batch = jobs.slice(i, i + batchSize);
  let nonce = await publicClient.getTransactionCount({ address: funder.address, blockTag: "pending" });
  const sent = [];
  for (const job of batch) {
    try {
      sent.push({ job, hash: await withRetry(() => send(job, nonce)) });
      nonce++;
    } catch (e) {
      console.error(`Could not send to ${job.address}: ${e.shortMessage || e.message}. Stopping, re-run to continue.`);
      break;
    }
  }
  await Promise.all(sent.map(async ({ job, hash }) => {
    try {
      const r = await withRetry(() => publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 }));
      if (r.status !== "success") throw new Error("reverted");
      ledger[`${job.address}:${job.kind}`] = hash;
      writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
      console.log(`  ok   ${job.kind.padEnd(4)} ${job.address} ${EXPLORER}/tx/${hash}`);
    } catch (e) {
      failed.push(job);
      console.error(`  FAIL ${job.kind.padEnd(4)} ${job.address} ${hash}: ${e.shortMessage || e.message}`);
    }
  }));
  if (sent.length < batch.length) process.exit(1);
}
console.log(failed.length ? `${failed.length} transfers failed, re-run to retry them.` : "All wallets funded.");
process.exit(failed.length ? 1 : 0);
