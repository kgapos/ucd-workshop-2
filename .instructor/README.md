## Instructor guide

Everything the instructor runs: funding, the class board, a self-hosted facilitator and a load test.
These tools live in the same repository as the student code and use the same `npm ci`. The folder is
hidden in the Codespaces file explorer to keep the students' view tidy. Open it from the terminal,
for example `code .instructor/README.md`.

## Table of Contents

- [Before the workshop](#before-the-workshop)
- [Hosting on a server with Docker](#hosting-on-a-server-with-docker)
- [On the day](#on-the-day)
- [Releasing the reference solution](#releasing-the-reference-solution)
- [Tools](#tools)
- [Why a self-hosted facilitator](#why-a-self-hosted-facilitator)

## Before the workshop

A few days ahead, because faucets limit how often you can claim.

1. Open your own Codespace on this repository, or use any machine with Node.js 22+ and run `npm ci`.

2. Create two wallets. Their keys go to `.instructor/.env`, which git ignores.

   ```bash
   # Sends USDC and ETH to students
   npm run wallet -- FUNDER_PRIVATE_KEY .instructor/.env
   # Pays the gas for every settlement in class
   npm run wallet -- FACILITATOR_PRIVATE_KEY .instructor/.env
   ```

3. Fund them on Base Sepolia:

   | Wallet | Needs | Where |
   |---|---|---|
   | Funder | about 1 USDC per student, plus 0.0005 ETH per student and a little gas | USDC: [faucet.circle.com](https://faucet.circle.com) (20 USDC per address every 2 hours). ETH: any Base Sepolia faucet. |
   | Facilitator | about 0.01 ETH (enough for thousands of settlements) | Any Base Sepolia ETH faucet. |

   Check them with `npm run balance -- <address>`.

4. Optionally, set `RPC_URL` in `.instructor/.env`. By default, every script uses four public Base Sepolia
   RPCs (listed in `config.js`) and fails over from one to the next. To use your own provider or node,
   set `RPC_URL` to one or more comma-separated endpoints, which replace the defaults.

5. Do a rehearsal (see [On the day](#on-the-day)), then run the load test at class size:

   ```bash
   npm run loadtest -- http://localhost:4021/fortune --requests 100 --concurrency 40
   ```

6. In [your Codespaces settings](https://github.com/settings/codespaces), raise the default idle
   timeout (up to 240 minutes) so your Codespace does not stop mid-session.

`.instructor/.env` reference (see [`.env.example`](.env.example)):

```bash
FUNDER_PRIVATE_KEY=0x...
FACILITATOR_PRIVATE_KEY=0x...
# RPC_URL=https://...,https://...         # optional, replaces the public RPCs in config.js
CLASS_FACILITATOR_URL=https://...-4022.app.github.dev   # public URL of your facilitator, handed to students
# USDC_AMOUNT=1      ETH_AMOUNT=0.0005    BATCH=10
```

## Hosting on a server with Docker

Instead of your Codespace, you can run the facilitator and the board on any Docker host, for example
a homelab. They keep running when your laptop sleeps, and they don't depend on Codespaces timeouts.

```bash
git clone https://github.com/kgapos/ucd-workshop-2 && cd ucd-workshop-2
# create .instructor/.env as above, then:
cd .instructor/infrastructure
docker compose up -d --build
docker compose ps        # both services should become "healthy"
docker compose logs -f   # settlements are logged as "settled #N <tx hash>"
```

This publishes the facilitator on port 4022 and the board on port 8081. Put both behind HTTPS with
your reverse proxy or tunnel of choice, then set `CLASS_FACILITATOR_URL` to the facilitator's public
URL and restart the board with `docker compose up -d`. Registrations are stored in the `board-data`
volume and survive restarts.

> :warning: Anyone who knows the facilitator URL can make it settle Base Sepolia payments, which
> costs its wallet testnet gas. Keep only a little ETH in it, and share the URL only with the class.

We do not run our own Base Sepolia node. The official node needs 32 GB+ RAM, a large NVMe disk, its
own L1 Sepolia RPC and beacon endpoints, and hours to days to sync. The public endpoints in
`config.js` handled 40 concurrent payments without errors in testing.

## On the day

In your Codespace, start the facilitator and the board in two terminals:

```bash
npm run facilitator     # port 4022
npm run board           # port 8081
```

Make both ports public, so students' servers and browsers can reach them:

```bash
gh codespace ports visibility 4022:public 8081:public -c "$CODESPACE_NAME"
```

Put the facilitator's public URL in `CLASS_FACILITATOR_URL` (in `.instructor/.env`) before students
register. The board hands it to every student, and `npm run register` saves it to their `.env`.

Then, during Part 1:

1. Put the board URL on a slide. Students run `npm run register -- <board-url>`.
2. Preview the funding, then send it:

   ```bash
   npm run fund -- https://<your-codespace>-8081.app.github.dev/apis.json --dry-run
   npm run fund -- https://<your-codespace>-8081.app.github.dev/apis.json
   ```

   Re-run the second command whenever more students have registered. Every successful transfer is
   recorded in `.instructor/funded.json`, so nobody gets paid twice.

3. Keep the board open on the projector. It refreshes every 10 seconds.

If the facilitator ever has trouble, students can delete the `FACILITATOR_URL` line from their
`.env` to fall back to the public facilitator at `https://x402.org/facilitator`.

## Releasing the reference solution

The reference solution is split into one branch per part, each on top of the one before:
`part/2-server` (TODOs 2.1 and 2.2), then `part/3-client` (TODOs 3.1 to 3.3), then `part/4-fortunes` (TODO 4.1).
They are pushed but **not merged** into `main`, and they add the `completed/` folder, so they merge cleanly.

When you are ready (for example an hour in), release Parts 2 to 4 in one go:

```bash
git switch main
git merge part/4-fortunes
git push origin main
```

To release part by part instead, merge `part/2-server`, `part/3-client` and `part/4-fortunes` in turn as the
class finishes each part. Students then run `git pull` and get `completed/` without conflicts, even if they
edited `starter/`.

### Challenge branches

Every challenge with code has its own branch on top of `part/4-fortunes`. The Part 5 TODOs in `starter/agent.js`
are challenge 10. Challenges 1 to 3 are hands-on, with no code. Most branches change `completed/server.js`, so
merging two of them usually conflicts. See one with `git diff part/4-fortunes challenge/<name>`, or check it out
to run it. All were tested on Base Sepolia on 2026-11-09, through the class facilitator
(`challenge/12-facilitator` through its own).

| Branch | Challenge |
|---|---|
| `challenge/4-stats` | Free `/stats`: fortunes sold, per route, and revenue, counted in an `onAfterSettle` hook so failed settlements do not count. |
| `challenge/5-premium` | `/premium` at $0.01, listed in `GET /` with its price. |
| `challenge/6-balance` | The client prints the USDC balance before paying, and after, read at the settlement's block. |
| `challenge/7-budget` | The client refuses to sign once the run would spend more than `BUDGET` USDC (default 0.05). |
| `challenge/8-bulk` | `/bulk?count=N` returns N fortunes at $0.001 each, capped at 10. The price is a function of the request. |
| `challenge/9-surge` | `/surge` costs $0.0001 more per request in the last minute. Quotes are remembered for 60 seconds, so the paid retry keeps the price the client signed. |
| `challenge/10-agent` | `completed/agent.js` solves TODOs 5.1 to 5.3: it buys the cheapest offer from each API on the board, once per seller, until its budget runs out. |
| `challenge/11-eurc` | `/fortune` accepts USDC or EURC. The client allows EURC with `setSpendControls` and pays in it with `PAY_WITH=EURC`. |
| `challenge/12-facilitator` | `completed/FACILITATOR.md`: run `.instructor/facilitator.js` with your own wallet, and what a dishonest facilitator can and cannot do. |
| `challenge/13-reseller` | `/resold` buys from `UPSTREAM_URL` and resells it in pirate at $0.002. It refuses upstream prices at or above its own. |
| `challenge/14-audit` | The server logs each sale to `sales.jsonl`, and `completed/audit.js` checks each one against a `Transfer` on-chain. |

## Tools

| Command | What it does |
|---|---|
| `npm run fund -- <source> [--dry-run] [--topup]` | Sends USDC (`USDC_AMOUNT`) and ETH (`ETH_AMOUNT`) to every address found in `<source>`. `<source>` can be the board's `/apis.json`, `.instructor/students.json`, or any CSV or text file: every `0x...` address in it is used. Sends in batches of `BATCH` with consecutive nonces, waits for receipts, retries failed broadcasts, and stops rather than leave a nonce gap. `--topup` ignores the ledger and tops everyone back up to the target. |
| `npm run board` | The class board on port 8081. `POST /register` adds a student, `GET /apis.json` lists everyone with their status, `GET /` is the live page. It checks every API every 15 seconds and counts USDC transfers on-chain every 10 seconds. Your funding transfers are not counted. It also shows the funder and facilitator balances, highlighted when they run low, and every student's USDC balance, so a missed funding transfer shows up as "not funded". Registrations persist in `.instructor/students.json`. Set `FROM_BLOCK` to choose where counting starts (default: about 2 hours back). |
| `npm run facilitator` | A self-hosted x402 facilitator for Base Sepolia on port 4022 (`/verify`, `/settle`, `/supported`). It pays gas from `FACILITATOR_PRIVATE_KEY`. |
| `npm run loadtest -- <paid-url> [--requests N] [--concurrency C]` | Sends N real paid requests, C at a time, and reports latency percentiles and a breakdown of outcomes and errors. It pays from `PRIVATE_KEY` in `.env`, or `LOADTEST_PRIVATE_KEY`. Each successful request costs its price in testnet USDC. |

## Why a self-hosted facilitator

On 2026-10-12, load tests against a local server gave these results (20 to 100 paid requests per run):

| Facilitator | RPC | Concurrency | Success |
|---|---|---|---|
| Public (`x402.org`) | theirs | 1 | 17 / 20 |
| Public (`x402.org`) | theirs | 2 | 11 / 20 |
| Public (`x402.org`) | theirs | 4 | 7 / 20 |
| Public (`x402.org`) | theirs | 10 | 3 / 20 |
| Self-hosted | `sepolia.base.org` | 1 | 20 / 20 |
| Self-hosted | `sepolia.base.org` | 10 | 10 / 20 |
| Self-hosted | alternative public RPC | 10 | 40 / 40 |
| Self-hosted | alternative public RPC | 20 | 40 / 40 |
| Self-hosted | alternative public RPC | 40 | 100 / 100 (16.5 req/s, p95 1.8 s) |

The public facilitator settles every payment, from everyone using it, through one wallet. Concurrent
settlements collide on nonces ("replacement transaction underpriced"), and it also hits RPC rate
limits ("Too Many Requests"). Our facilitator uses viem's `nonceManager`, so concurrent settlements
get consecutive nonces, and with a dedicated RPC it comfortably handles a full class.

A failed settlement never costs the student anything: the signed authorisation is simply never
submitted.
