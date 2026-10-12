// Live class board: who has registered, whose API is up, and how many paid requests each one received.
// Usage: npm run board   (then make port 8081 public and share the URL)
import express from "express";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAddress, getAddress, parseAbiItem, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, USDC, EXPLORER, publicUrl } from "../config.js";

const PORT = Number(process.env.BOARD_PORT || 8081);
const CLASS_FACILITATOR = process.env.CLASS_FACILITATOR_URL; // handed to students when they register
const FILE = process.env.STUDENTS_FILE || new URL("students.json", import.meta.url);
const funder = process.env.FUNDER_PRIVATE_KEY && privateKeyToAccount(process.env.FUNDER_PRIVATE_KEY).address;
const facilitator = process.env.FACILITATOR_PRIVATE_KEY && privateKeyToAccount(process.env.FACILITATOR_PRIVATE_KEY).address;
const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

const students = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {}; // keyed by address
const status = {}; // address -> { up, note, received, count, spent, paidOut }
const wallets = {}; // address -> { address, usdc, eth, low }

const app = express();
app.set("trust proxy", true); // behind a reverse proxy, req.protocol comes from X-Forwarded-Proto
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

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2563eb"/><text x="32" y="42" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">402</text></svg>`;
// Token marks shown next to amounts (simplified USDC and ETH logos).
const TOKEN = {
  USDC: `<svg class="token" viewBox="0 0 32 32" role="img" aria-label="USDC"><title>USDC</title><circle cx="16" cy="16" r="16" fill="#2775ca"/><text x="16" y="22.5" font-family="system-ui,sans-serif" font-size="19" font-weight="700" fill="#fff" text-anchor="middle">$</text></svg>`,
  ETH: `<svg class="token" viewBox="0 0 32 32" role="img" aria-label="ETH"><title>ETH</title><circle cx="16" cy="16" r="16" fill="#627eea"/><path fill="#fff" fill-opacity=".6" d="M16 4v8.9l7.5 3.3z"/><path fill="#fff" d="M16 4 8.5 16.2l7.5-3.3z"/><path fill="#fff" fill-opacity=".6" d="M16 22v6l7.5-10.4z"/><path fill="#fff" d="M16 28v-6l-7.5-4.4z"/><path fill="#fff" fill-opacity=".2" d="m16 20.6 7.5-4.4-7.5-3.3z"/><path fill="#fff" fill-opacity=".6" d="m8.5 16.2 7.5 4.4v-7.7z"/></svg>`,
};
app.get("/favicon.svg", (req, res) => res.type("image/svg+xml").send(ICON));

app.get("/", (req, res) => {
  const rows = Object.values(students)
    .map((s) => ({ ...s, ...status[s.address] }))
    .sort((a, b) => (b.count || 0) - (a.count || 0));
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const usdc = (v) => formatUnits(BigInt(v || 0), 6);
  const boardUrl = `${req.protocol}://${req.get("host")}`;
  const up = rows.filter((r) => r.up).length;
  const paid = rows.reduce((n, r) => n + (r.count || 0), 0);
  const earned = rows.reduce((n, r) => n + BigInt(r.received || 0), 0n);
  const addr = (a) => `<a href="${EXPLORER}/address/${a}#tokentxns"><code>${a.slice(0, 6)}…${a.slice(-4)}</code></a>`;
  const stat = (label, value) => `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  const wallet = (label, w) => w && `<div class="card wallet${w.low ? " low" : ""}"><div class="label"><a href="${EXPLORER}/address/${w.address}#tokentxns" title="${w.address}">${label}</a></div>
    <div class="value">${w.usdc == null ? "…" : `${w.address === funder ? `<span class="amt">${TOKEN.USDC}${Number(w.usdc).toFixed(2)}</span>` : ""}<span class="amt">${TOKEN.ETH}${Number(w.eth).toFixed(4)}</span>`}</div>
    ${w.low ? `<div class="note">${esc(w.low)}</div>` : ""}</div>`;
  res.send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="10">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Class Board</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch {}</script>
<style>
  :root { --bg: #f6f7f9; --panel: #fff; --text: #111827; --muted: #6b7280; --border: #e5e7eb; --accent: #2563eb;
    --up: #15803d; --up-bg: #dcfce7; --down: #b91c1c; --down-bg: #fee2e2; --warn: #b45309; --warn-bg: #fef3c7; color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0b0f17; --panel: #131a26; --text: #e5e7eb;
    --muted: #9ca3af; --border: #243044; --accent: #60a5fa; --up: #4ade80; --up-bg: #14532d55; --down: #f87171; --down-bg: #7f1d1d55;
    --warn: #fbbf24; --warn-bg: #78350f55; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #0b0f17; --panel: #131a26; --text: #e5e7eb; --muted: #9ca3af; --border: #243044; --accent: #60a5fa;
    --up: #4ade80; --up-bg: #14532d55; --down: #f87171; --down-bg: #7f1d1d55; --warn: #fbbf24; --warn-bg: #78350f55; color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 72rem; margin: 0 auto; padding: 2rem 1rem 3rem; }
  header { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
  header img { width: 2.25rem; height: 2.25rem; }
  h1 { font-size: 1.6rem; margin: 0; letter-spacing: -.01em; flex: 1; }
  a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
  code { font: .85em ui-monospace, SFMono-Regular, Menlo, monospace; }
  button { font: inherit; color: var(--text); background: var(--panel); border: 1px solid var(--border); border-radius: 999px; width: 2.25rem; height: 2.25rem; display: grid; place-items: center; cursor: pointer; }
  button:hover { border-color: var(--accent); color: var(--accent); }
  .register { margin: 1rem 0 1.5rem; display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; color: var(--muted); }
  .register code { background: var(--panel); border: 1px solid var(--border); border-radius: .5rem; padding: .35rem .6rem; color: var(--text); overflow-wrap: anywhere; }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: .75rem; margin-bottom: 1.5rem; }
  @media (max-width: 60rem) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 30rem) { .grid { grid-template-columns: repeat(2, 1fr); } }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: .75rem; padding: .8rem 1rem; }
  .label { color: var(--muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
  .label a { color: inherit; }
  .value { font-size: 1.5rem; font-weight: 650; font-variant-numeric: tabular-nums; }
  .wallet .value { display: flex; flex-direction: column; }
  .amt { display: inline-flex; align-items: center; gap: .4rem; } .token { width: 1.1em; height: 1.1em; flex: none; } small { color: var(--muted); font-weight: 500; }
  .low { border-color: var(--warn); background: var(--warn-bg); } .note { color: var(--warn); font-size: .85rem; }
  .table { background: var(--panel); border: 1px solid var(--border); border-radius: .75rem; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; white-space: nowrap; }
  th, td { padding: .6rem .9rem; text-align: left; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
  tr:last-child td { border-bottom: 0; } tbody tr:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .pill { display: inline-block; border-radius: 999px; padding: .1rem .55rem; font-size: .8rem; font-weight: 600; margin-right: .4rem; }
  .pill.up { color: var(--up); background: var(--up-bg); } .pill.down { color: var(--down); background: var(--down-bg); }
  .empty { padding: 2rem; text-align: center; color: var(--muted); }
  footer { margin-top: 1rem; color: var(--muted); font-size: .8rem; }
</style>
<main>
<header><img src="/favicon.svg" alt=""><h1>x402 class board</h1><button id="theme" type="button" aria-label="Toggle theme" title="Toggle theme"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg></button></header>
<div class="register">Register with <code>npm run register -- ${esc(boardUrl)}</code></div>
<div class="grid">${stat("Registered", rows.length)}${stat("APIs up", up)}${stat("Paid requests", paid)}${stat("USDC moved", `<span class="amt">${TOKEN.USDC}${usdc(earned)}</span>`)}${wallet("Funder", wallets[funder]) || ""}${wallet("Facilitator gas", wallets[facilitator]) || ""}</div>
<div class="table">${rows.length ? `<table><thead><tr><th>#</th><th>Name</th><th>API</th><th class="num">Paid requests</th><th class="num">USDC earned</th><th class="num">Payments made</th><th>Wallet</th></tr></thead><tbody>
${rows.map((r, i) => `<tr><td>${i < 3 && r.count ? ["🥇", "🥈", "🥉"][i] : i + 1}</td><td>${esc(r.name)}</td>
<td><span class="pill ${r.up ? "up" : "down"}">${r.up ? "up" : esc(r.note || "down")}</span><a href="${esc(r.url)}">${esc(r.url.replace(/^https?:\/\//, "").slice(0, 32))}</a></td>
<td class="num">${r.count || 0}</td><td class="num">${usdc(r.received)}</td><td class="num">${r.paidOut || 0}</td>
<td>${addr(r.address)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Nobody has registered yet.</div>`}</div>
<footer>Base Sepolia · refreshes every 10 seconds · <a href="/apis.json">apis.json</a></footer>
</main>
<script>document.getElementById("theme").onclick = () => {
  const root = document.documentElement, dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch {}
};</script>`);
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

// Instructor wallet balances, with a warning when they run low.
// ponytail: fixed thresholds, enough for one more student (funder) or a few hundred settlements (facilitator).
const balanceOf = parseAbiItem("function balanceOf(address) view returns (uint256)");
async function checkWallets() {
  for (const [address, low] of [[funder, (u, e) => u < 1 || e < 0.0005], [facilitator, (u, e) => e < 0.002]]) {
    if (!address) continue;
    const [u, e] = await Promise.all([
      publicClient.readContract({ address: USDC, abi: [balanceOf], functionName: "balanceOf", args: [address] }),
      publicClient.getBalance({ address }),
    ]);
    const w = { address, usdc: formatUnits(u, 6), eth: formatUnits(e, 18) };
    w.low = low(Number(w.usdc), Number(w.eth)) ? "Running low, top it up" : "";
    wallets[address] = w;
  }
}

const every = (ms, fn) => { const run = () => fn().catch((e) => console.error(fn.name, e.shortMessage || e.message)); run(); setInterval(run, ms); };
every(15_000, checkApis);
every(10_000, countPayments);
every(30_000, checkWallets);

app.listen(PORT, () => console.log(`Class board on ${publicUrl(PORT)} (make port ${PORT} public)`));
