## Workshop TODO

Remaining tasks before, during and after the workshop. Amounts assume 40 students.

### Funding

- [ ] Claim USDC for the funder `0x7D318699609Bd72371F6bFa19151763a620d8Bfa` at
      [faucet.circle.com](https://faucet.circle.com) (USDC, Base Sepolia, 20 per claim, once every 2 hours).
      Target: about 50 USDC (40 for students plus room for top-ups and load tests). Had 15.25 on 2026-10-12,
      so 2 more claims.
- [ ] Top up the funder with Base Sepolia ETH. Target: 0.03 ETH (40 x 0.0005 for students, plus gas).
      Had 0.022 on 2026-10-12.
- [ ] Check the facilitator gas wallet `0x8E235bF4167D759A61355A7cB0b37A1FcbeDCfe8`. Target: 0.01 to 0.02 ETH.
      Had 0.025 on 2026-10-12, which is enough. Keep it small, since the facilitator URL is public.
- [ ] Check all balances with `npm run balance -- <address>`.

### Homelab infrastructure

- [x] Clone the repository on the Docker host.
- [x] Copy `.instructor/.env` to the host (`FUNDER_PRIVATE_KEY`, `FACILITATOR_PRIVATE_KEY`, `RPC_URL`).
      Use a secure channel, and never commit it.
- [x] `cd .instructor/infrastructure && docker compose up -d --build`, then check that both services are healthy.
- [x] Expose both services over HTTPS: `https://facilitator.kgapos.com` -> port 4022 and
      `https://ucd.kgapos.com` -> port 8081.
- [x] Set `CLASS_FACILITATOR_URL=https://facilitator.kgapos.com` in `.instructor/.env` and run `docker compose up -d`.
- [x] Verify from outside: `curl https://facilitator.kgapos.com/supported` and open `https://ucd.kgapos.com`.
      Checked on 2026-10-12: a payment settled through the facilitator, and a load test passed 40/40 at concurrency 20.
- [ ] Add the two extra public RPCs (Tenderly, OnFinality) to `RPC_URL` in the homelab `.instructor/.env`, as in the
      instructor README, then run `docker compose up -d`.

### Rehearsal (the day before)

- [ ] Open a fresh Codespace as a student: `npm run wallet`, `npm run register -- https://ucd.kgapos.com`,
      then confirm `FACILITATOR_URL` was saved to `.env`.
- [ ] Fund it with `npm run fund -- https://ucd.kgapos.com/apis.json`, then complete Parts 1 and 2 using the TODO hints.
- [ ] Load test at class size against an API that uses the homelab facilitator:
      `npm run loadtest -- <api-url>/fortune --requests 100 --concurrency 40`.
- [ ] Clear test registrations: stop the board, delete `students.json` from the `board-data` volume, then start it again.
      Also remove the test entries from `.instructor/funded.json` on the machine you fund from.
- [ ] Delete test Codespaces (`gh codespace list`, `gh codespace delete`).

### Repository

- [x] Make the repository public, so that students can create Codespaces from it on their own accounts.
      Nothing secret is committed. The `solution` branch is local only and stays private until you push it.
- [x] Optionally, add a description, topics and a banner image like the previous workshop.
- [x] Drop the two redundant stash entries left over from development (`git stash list`, then `git stash drop`).

### Slides

- [ ] Create the Part 0 presentation (about 10 minutes): HTTP 402, the x402 flow, the facilitator's role,
      why stablecoins suit machine payments, why Base Sepolia, and the workshop plan.
- [ ] Add a slide with the board URL, and one with the commands for Part 0.
- [ ] Add a closing slide with the challenges and the resources.

### On the day

- [ ] Before students arrive: check that `docker compose ps` is healthy, open the board on the projector,
      and confirm the funder balances.
- [ ] Part 0: share the board URL. Once most students have registered, run
      `npm run fund -- https://ucd.kgapos.com/apis.json --dry-run`, then run it for real.
      Re-run it for late arrivals.
- [ ] About an hour in: release the reference solution (`git merge solution && git push origin main`) and
      tell students to `git pull`.

### Optional

- [ ] Verify the EURC challenge (number 11) end to end: claim EURC to the funder and test a route that
      accepts both USDC and EURC.
- [ ] Restrict the facilitator to settle only payments to registered students' addresses, to limit abuse
      of the public URL.
- [ ] After the workshop: stop the services, and optionally send leftover testnet funds back to a faucet.
