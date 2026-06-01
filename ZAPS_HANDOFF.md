# Chain-agnostic zaps — handoff

Status as of this branch (`pr/chain-agnostic-zaps`). Read this first if you're picking the work up.

## What's done

All six milestones from the brief are implemented, type-checked, linted, and `npm test`
(tsc + eslint + vitest + vite build) passes. The on-chain logic is validated offline:
Stacks address matches `wallet.ts`, the SIP-010 call + post-condition serialize, the EVM
address matches the canonical BIP39 vector, RLP passes standard vectors, and the EIP-1559
signature round-trips through public-key recovery.

- **`src/lib/zaps/`** — `caip.ts` (CAIP-2/10/19 + chain-match check), `assets.ts` (sBTC on
  Stacks + USDC on Ethereum, bound to adapters), `events.ts` (kind:10020 / 9734 / 9735
  build+parse), `verify.ts` (trust path), `chains/{stacks,evm}.ts` (derive/send/verify/balance).
- **Wallet page** → `ZapAcceptanceManager`: pick assets, publish `kind:10020`, privacy warning.
- **Index page** → zap button + `ZapDialog` (discovery → passkey unlock → PUSH → receipt) and
  `ZapList` (verified zaps shown, unverifiable ones flagged not hidden). Boosted-upvote links a
  `kind:7` reaction to the zap.
- **`NIP.md`** documents the kinds.

Identity note: the logged-in user (account-0 key, `m/44'/1237'/0'/0/0`) already signs all Nostr
events; the chain signer is the passkey-derived seed via `usePasskeyMnemonic` (RECEPTION_SALT).

## NOT yet verified — do this first next session

1. **Live mainnet smoke test.** No real broadcast has run. Send a tiny sBTC amount end-to-end
   (advertise → zap → receipt → see it render verified, txid on Hiro explorer). Then the EVM
   (USDC) path. The send path is wired and self-consistent but unexercised against a live node.
   - Stacks fee/nonce are fetched by `@stacks/transactions` at send time (network call).
   - EVM uses `https://ethereum-rpc.publicnode.com`; check nonce/gas estimation under real load.
2. **Lock the kind number.** `kind:10020` is PROVISIONAL. Open an issue on cocoa007's
   `nip-caip358-zaps` repo; if the companion NIP lands elsewhere, change `KIND_ZAP_ACCEPT`
   in `src/lib/zaps/events.ts` (single source of truth) and update `NIP.md`.

## Good follow-ups (not blocking)

- Show the sender's live balance per asset in `ZapDialog` (adapter `balanceOf` exists; currently
  only used as a pre-send guard, not surfaced in discovery).
- Honor the recipient's `relay` tags from their 10020 when publishing 9734/9735 (currently uses
  the sender's write relays; brief says fall back to NIP-65 if absent).
- After broadcast, the receipt is published with `status: "pending"`; consider a follow-up
  publish (or let verify.ts's on-chain check drive the displayed status, which it already does).
- `ZAP_ASSETS` is the place to add chains/tokens; each new namespace needs a `ChainAdapter`.

## How to run / verify

- `npm run dev` then open `/wallet` (enable zaps) and `/` (zap button).
- `npm test` must stay green. Don't add test files unless asked (project policy in AGENTS.md).
- Branch is an ngit PR (`pr/chain-agnostic-zaps`); update it with `git push origin pr/chain-agnostic-zaps`.
