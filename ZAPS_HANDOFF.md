# Chain-agnostic zaps — handoff

Status as of this branch (`pr/chain-agnostic-zaps`). Read this first if you're picking the work up.

## What's done

All six milestones from the brief are implemented, type-checked, linted, and `npm test`
(tsc + eslint + vitest + vite build) passes. The on-chain logic is validated offline:
Stacks address matches `wallet.ts`, the SIP-010 call + post-condition serialize, the EVM
address matches the canonical BIP39 vector, RLP passes standard vectors, and the EIP-1559
signature round-trips through public-key recovery.

- **`src/lib/zaps/`** — `caip.ts` (CAIP-2/10/19 + chain-match check), `assets.ts` (sBTC on
  Stacks + USDC on Ethereum, bound to adapters), `events.ts` (kind:10021 / 9734 / 9735
  build+parse), `verify.ts` (trust path), `chains/{stacks,evm}.ts` (derive/send/verify/balance).
- **Wallet page** → `ZapAcceptanceManager`: pick assets, publish `kind:10021`, privacy warning.
- **Index page** → zap button + `ZapDialog` (discovery → passkey unlock → PUSH → receipt) and
  `ZapList` (verified zaps shown, unverifiable ones flagged not hidden). Boosted-upvote links a
  `kind:7` reaction to the zap.
- **`NIP.md`** documents the kinds.

Identity note: the logged-in user (account-0 key, `m/44'/1237'/0'/0/0`) already signs all Nostr
events; the chain signer is the passkey-derived seed via `usePasskeyMnemonic` (RECEPTION_SALT).

## NOT yet verified — do this first next session

1. **Live mainnet smoke test.** No real broadcast has run for any asset. Send a tiny amount of
   each end-to-end (advertise → zap → receipt → render verified, txid on the explorer). The send
   paths are wired and self-consistent but unexercised against a live node.
   - **sBTC (Stacks):** fee/nonce fetched by `@stacks/transactions`; self-paid if the sender holds
     STX, else fee-sponsored via tx2.app (`/v1/sponsor`) — exercise BOTH branches.
   - **USDC / native ETH (eip155):** hand-rolled EIP-1559 via `https://ethereum-rpc.publicnode.com`;
     check nonce/gas estimation under real load.
   - **native SOL (solana):** System-Program transfer via `api.mainnet-beta.solana.com`.
   - **EURC (SPL on Solana):** ATA derivation (`associatedTokenAddress`) and `verify()` token-
     balance-delta parsing are CHAIN-VALIDATED — derived ATA for owner 7mXW…HtJU2 matched the
     account the chain used in tx 4Vtsh…GvAZ (`6Z2c…jGKH`), and the pre/postTokenBalances shape +
     delta logic matched that real EURC transfer. Still unproven: the exact `buildSplMessage` byte
     encoding (instruction discriminators / account ordering) — confirm with one tiny real send.
     Note the send funds the recipient's ATA rent (`CreateIdempotent`), so the sender needs a
     little SOL even though the asset is EURC.
2. **Kind number — LOCKED at `kind:10021`** (was provisionally 10020, which is already
   allocated to "Media follows" / NIP-51). Fixed by the companion NIP on cocoa007's
   `nip-caip358-zaps` repo. `KIND_ZAP_ACCEPT` in `src/lib/zaps/events.ts` and `NIP.md` are
   updated to match. Remaining: the upstream nostr-protocol/nips PR formally reserving 10021
   in the kinds table is still pending.

## Good follow-ups (not blocking)

- Show the sender's live balance per asset in `ZapDialog` (adapter `balanceOf` exists; currently
  only used as a pre-send guard, not surfaced in discovery).
- Honor the recipient's `relay` tags from their 10021 when publishing 9734/9735 (currently uses
  the sender's write relays; brief says fall back to NIP-65 if absent).
- After broadcast, the receipt is published with `status: "pending"`; consider a follow-up
  publish (or let verify.ts's on-chain check drive the displayed status, which it already does).
- `ZAP_ASSETS` is the place to add chains/tokens; each new namespace needs a `ChainAdapter`.

## How to run / verify

- `npm run dev` then open `/wallet` (enable zaps) and `/` (zap button).
- `npm test` must stay green. Don't add test files unless asked (project policy in AGENTS.md).
- Branch is an ngit PR (`pr/chain-agnostic-zaps`); update it with `git push origin pr/chain-agnostic-zaps`.
