// Live class board: who has registered, whose API is up, and how many paid requests each one received.
// Usage: npm run board   (then make port 8080 public and share the URL)
import express from "express";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAddress, getAddress, parseAbiItem, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, USDC, EXPLORER, publicUrl } from "../config.js";

const PORT = Number(process.env.BOARD_PORT || 8080);
const CLASS_FACILITATOR = process.env.CLASS_FACILITATOR_URL; // handed to students when they register
const FILE = process.env.STUDENTS_FILE || new URL("students.json", import.meta.url);
const funder = process.env.FUNDER_PRIVATE_KEY && privateKeyToAccount(process.env.FUNDER_PRIVATE_KEY).address;
const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

const students = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {}; // keyed by address
const status = {}; // address -> { up, note, received, count, spent, paidOut }

const app = express();
app.use(express.json());

app.post("/register", (req, res) => {
  const { name, address, url } = req.body || {};
  if (!/^[\w.-]{1,39}$/.test(name || "")) return res.status(400).send("name: 1-39 letters, digits, . _ -");
  if (!isAddress(address || "")) return res.status(400).send("address: not a valid EVM address");
  if (!/^https?:\/\/[^\s]{1,200}$/.test(url || "")) return res.status(400).send("url: must start with http(s)://");
  for (const [a, s] of Object.entries(students)) if (s.name === name) delete students[a]; // re-registering replaces
  students[getAddress(address)] = { name, address: getAddress(address), url: url.replace(/\/$/, "") };
  writeFileSync(FILE, JSON.stringify(students, null, 2));
  res.json({ ok: true, facilitator: CLASS_FACILITATOR });
});

// Machine-readable list for clients and agents.
app.get("/apis.json", (req, res) => res.json(Object.values(students).map((s) => ({ ...s, ...status[s.address] }))));

app.get("/", (req, res) => {
  const rows = Object.values(students)
    .map((s) => ({ ...s, ...status[s.address] }))
    .sort((a, b) => (b.count || 0) - (a.count || 0));
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  res.send(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="10">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Class Board</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 2rem auto; max-width: 70rem; padding: 0 1rem; }
  table { border-collapse: collapse; width: 100%; } td, th { padding: .4rem .6rem; text-align: left; border-bottom: 1px solid #8884; }
  .up { color: #1a7f37; } .down { color: #cf222e; } code { font-size: .85em; } .num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
<h1>x402 class board</h1>
<p>${rows.length} registered, ${rows.filter((r) => r.up).length} APIs up. Register with <code>npm run register -- ${esc(publicUrl(PORT))}</code></p>
<table><tr><th>#</th><th>Name</th><th>API</th><th class="num">Paid requests received</th><th class="num">USDC earned</th><th class="num">Payments made</th><th>Wallet</th></tr>
${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td>
<td class="${r.up ? "up" : "down"}">${r.up ? "● up" : "○ " + esc(r.note || "down")} <a href="${esc(r.url)}">${esc(r.url.replace(/^https?:\/\//, "").slice(0, 32))}</a></td>
<td class="num">${r.count || 0}</td><td class="num">${formatUnits(BigInt(r.received || 0), 6)}</td><td class="num">${r.paidOut || 0}</td>
<td><a href="${EXPLORER}/address/${r.address}#tokentxns"><code>${r.address.slice(0, 10)}…</code></a></td></tr>`).join("")}
</table>`);
});

// Is each API reachable? A private Codespaces port answers with a login redirect instead of JSON.
async function checkApis() {
  await Promise.all(Object.values(students).map(async (s) => {
    const st = (status[s.address] ||= {});
    try {
      const r = await fetch(s.url + "/", { redirect: "manual", signal: AbortSignal.timeout(4000) });
      st.up = r.ok;
      st.note = r.ok ? "" : [301, 302, 401].includes(r.status) ? "port is private" : `HTTP ${r.status}`;
    } catch {
      st.up = false;
      st.note = "unreachable";
    }
  }));
}

// Count USDC transfers between wallets (the instructor's funding transfers are ignored).
// Every address is tallied, so students who register late still get credit for earlier payments.
// ponytail: the public RPC caps eth_getLogs at 200 blocks, so we scan forward in 200-block chunks.
let nextBlock = process.env.FROM_BLOCK ? BigInt(process.env.FROM_BLOCK) : (await publicClient.getBlockNumber()) - 3600n; // about 2 hours
async function countPayments() {
  const latest = await publicClient.getBlockNumber();
  while (nextBlock <= latest) {
    const toBlock = nextBlock + 199n < latest ? nextBlock + 199n : latest;
    const logs = await publicClient.getLogs({ address: USDC, event: transfer, fromBlock: nextBlock, toBlock });
    for (const { args } of logs) {
      if (args.from === funder) continue;
      const to = (status[args.to] ||= {});
      to.count = (to.count || 0) + 1;
      to.received = (BigInt(to.received || 0) + args.value).toString();
      const from = (status[args.from] ||= {});
      from.paidOut = (from.paidOut || 0) + 1;
    }
    nextBlock = toBlock + 1n;
  }
}

const every = (ms, fn) => { const run = () => fn().catch((e) => console.error(fn.name, e.shortMessage || e.message)); run(); setInterval(run, ms); };
every(15_000, checkApis);
every(10_000, countPayments);

app.listen(PORT, () => console.log(`Class board on ${publicUrl(PORT)} (make port ${PORT} public)`));
