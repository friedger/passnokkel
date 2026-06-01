# passnokkel custom & extended kinds

passnokkel implements chain-agnostic zaps: a serverless, passkey-anchored loop where a
recipient advertises which on-chain assets they accept, a sender pushes a real on-chain
payment, and anyone can verify the zap against the recipient's signed advertisement and the
blockchain. It ties together the Breez passkey-login derivation, NIP-57, and the CAIP-358 zaps
draft.

All three event kinds are signed by the user's **account-0 Nostr identity**
(`m/44'/1237'/0'/0/0`), the same key derived from the passkey at login.

---

## kind:10021 — chain-agnostic zap acceptance

> **Status: locked.** This number is fixed by the companion NIP on cocoa007's
> `nip-caip358-zaps` repo (`nip-caip358-zap-advertisement.md`). 10020 was used in an
> earlier draft but is already allocated to "Media follows" (NIP-51), so 10021 is used.
> `KIND_ZAP_ACCEPT` in `src/lib/zaps/events.ts` remains the single source of truth in this codebase.

A **replaceable** event (10000–19999): only the latest per pubkey is kept, so re-publishing
replaces the prior advertisement. It declares which assets/addresses the author accepts.

| Tag      | Format                                                          | Notes |
|----------|-----------------------------------------------------------------|-------|
| `accept` | `["accept", <CAIP-19 asset>, <CAIP-10 account>, <transfer-type>]`| One per asset. The CAIP-19 chain MUST match the CAIP-10 chain. |
| `relay`  | `["relay", <wss url>]`                                          | Author's inbox relays for the zap flow. |
| `lud16`  | `["lud16", <address>]`                                          | Optional Lightning fallback. |
| `alt`    | NIP-31 human-readable description                              | Required for custom kinds. |

`content` is empty. Example (sBTC on Stacks mainnet):

```json
{
  "kind": 10021,
  "tags": [
    ["alt", "Chain-agnostic zap acceptance (NIP-57 + CAIP-358)"],
    ["relay", "wss://relay.damus.io"],
    ["accept",
      "stacks:1/SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token.sbtc-token",
      "stacks:1:SP…",
      "sip10-transfer"]
  ],
  "content": ""
}
```

**Trust:** a 10021 is user-owned and replaceable, so the **author is the trust boundary** —
always query by `authors`. The advertised, signed address is the only source of truth for where
a zap may be sent; never trust an address from a receipt or request alone.

---

## kind:9734 — zap request (NIP-57, CAIP-358 extension)

Standard NIP-57 zap request, **not published to relays** (it is embedded in the receipt's
`description`). Extended for on-chain assets:

- `["payment_type", "caip358"]`
- `["caip358_request", <JSON>]` — a CAIP-358 PaymentRequest:
  `{ version, orderId, expiry, paymentOptions: [{ asset, amount (hex), recipient, types }] }`.
  `amount` is hex-encoded base units; `orderId` is unique (replay protection).
- `["amount", <decimal base units>]`, `["p", <recipient>]`, `["e", <note>]`, `["relays", …]`.
- Optional `["e", <reaction-id>, "", "reaction"]` links a "boosted upvote" to its kind-7 reaction.

## kind:9735 — zap receipt (NIP-57, CAIP-358 extension)

For a serverless PUSH payment the **sender** publishes the receipt (allowed because PUSH is
independently verifiable on-chain). Extended tags:

- `["payment_type", "caip358"]`, `["network", <CAIP-2>]`, `["txid", <0x…>]`, `["asset", <CAIP-19>]`
- `["caip358_receipt", <JSON>]` — `{ version, orderId, asset, amount, recipient, sender, txid, status }`
- `["description", <JSON of the kind-9734>]` and an empty `["bolt11", ""]` so NIP-57 clients that
  require the tag don't choke.

**Verification** (`src/lib/zaps/verify.ts`): decode `description` → 9734; confirm the receipt's
asset + recipient address match an `accept` entry in the recipient's 10021 (trust anchor); then
query the chain for the `txid` and confirm sender/recipient/asset/amount and finality. Zaps that
fail any step are flagged, not hidden.
