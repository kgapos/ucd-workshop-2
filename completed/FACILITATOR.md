# Challenge 12: run your own facilitator

## Run it

The class facilitator is [`.instructor/facilitator.js`](../.instructor/facilitator.js). Run the same file with your own wallet paying the gas. Your 0.0005 ETH covers hundreds of settlements on Base Sepolia.

In a second terminal:

```bash
FACILITATOR_PRIVATE_KEY=$(grep '^PRIVATE_KEY=' .env | cut -d= -f2) node .instructor/facilitator.js
```

Then point your server at it. In `.env`, set:

```bash
FACILITATOR_URL=http://localhost:4022
```

Restart the server and pay yourself with `node --env-file=.env completed/client.js`. The facilitator logs `settled #1 0x...`. On the explorer, the transaction's sender is now your own address: you paid the gas.

`curl localhost:4022/supported` shows what it can settle.

## What could a dishonest facilitator do?

Your server trusts the facilitator's answers, so a dishonest one could:

- **Censor:** refuse to verify or settle payments, for some payers or for everyone.
- **Lie to the server:** say a payment is valid or settled when it is not. It can even return a made-up transaction hash. Your server would then serve paid content for free.
- **Lie the other way:** reject good payments, so your customers get a 402 and leave.
- **Hold a payment:** delay settling the authorization until just before its `validBefore` deadline.
- **Watch:** it sees every payment: who paid whom, how much, and for which URL.

## What could it not do?

The payer signs an EIP-3009 `transferWithAuthorization`. That signature fixes the token, the sender, the recipient, the amount, a time window and a one-time nonce. So the facilitator cannot:

- change the amount or the token;
- redirect the money to itself or anyone else, because `payTo` is signed;
- settle the same payment twice, because the token contract burns the nonce;
- touch the rest of the payer's balance;
- settle it after it expires.

In short, the facilitator can hurt the **seller**, by lying or censoring, but not the **buyer**'s money beyond what they signed. Running your own, or checking the chain yourself (challenge 14), removes the need to trust it.
