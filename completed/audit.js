// Challenge 14: audit yourself. Checks every sale in the server's ledger (sales.jsonl) against the chain:
// the transaction must exist, succeed, and contain a token Transfer of the right amount from the payer to you.
// It also catches one transaction being claimed for two sales. A facilitator that lies about settling fails here.
// Usage: node --env-file=.env completed/audit.js [sales.jsonl]
import { readFileSync } from "node:fs";
import { parseEventLogs, erc20Abi, formatUnits } from "viem";
import { publicClient, EXPLORER } from "../config.js";

const file = process.argv[2] || process.env.SALES_FILE || "sales.jsonl";
const sales = readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
const seen = new Set(); // transactions already matched to a sale
let bad = 0;

for (const sale of sales) {
  const tx = sale.transaction?.toLowerCase();
  const problem = await check(sale, tx);
  if (problem) bad++;
  console.log(`${problem ? "FAIL" : "ok  "} ${sale.time} ${sale.route} ${formatUnits(BigInt(sale.amount), 6)} ${problem || ""}`);
  if (problem) console.log(`     ${EXPLORER}/tx/${sale.transaction}`);
}
console.log(`\n${sales.length - bad}/${sales.length} sales are paid for on-chain.`);
process.exit(bad ? 1 : 0);

async function check(sale, tx) {
  if (seen.has(tx)) return "transaction already used by another sale";
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: tx });
  } catch {
    return "no such transaction";
  }
  if (receipt.status !== "success") return "transaction reverted";
  const paid = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs }).some(
    (log) =>
      log.address.toLowerCase() === sale.asset.toLowerCase() &&
      log.args.from.toLowerCase() === sale.payer?.toLowerCase() &&
      log.args.to.toLowerCase() === sale.payTo.toLowerCase() &&
      log.args.value === BigInt(sale.amount),
  );
  if (!paid) return "no matching Transfer in the transaction";
  seen.add(tx);
}
