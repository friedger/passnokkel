import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

import { seedFromMnemonic } from '../wallet';
import { ZAP_ASSETS } from './assets';
import { stacksAdapter } from './chains/stacks';
import {
  buildAcceptEvent,
  buildZapReceipt,
  buildZapRequest,
  makeOrderId,
  parseAcceptEvent,
  type Caip358Receipt,
  type ZapEventTemplate,
} from './events';
import { verifyZapReceipt } from './verify';

// End-to-end test of the serverless chain-agnostic zap loop, exercising the
// REAL event build/parse (events.ts) and verification trust-path (verify.ts).
// Only the chain itself is mocked — `stacksAdapter` is backed by an in-memory
// ledger so a `send` actually moves base units between addresses and a later
// `balanceOf` reflects it. This is the full journey the task describes:
// author publishes a kind:10021 → sender pushes on-chain → the author's
// account balance goes up.

const sbtc = ZAP_ASSETS.find((a) => a.id === 'sbtc')!;

// Two distinct BIP39 vectors → two real, distinct Stacks addresses (pure, no I/O).
const RECIPIENT_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const SENDER_MNEMONIC =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';

/** Sign a zap event template with a throwaway key, as a wallet/client would. */
function sign(template: ZapEventTemplate, sk: Uint8Array, createdAt: number): NostrEvent {
  return finalizeEvent(
    {
      kind: template.kind,
      content: template.content ?? '',
      tags: template.tags ?? [],
      created_at: createdAt,
    },
    sk,
  ) as unknown as NostrEvent;
}

describe('e2e: chain-agnostic zap (author advertises kind:10021 → balance increases)', () => {
  let ledger: Map<string, bigint>;
  let txs: Map<string, { from: string; to: string; amount: bigint; asset: string }>;
  let recipientAddr: string;
  let senderAddr: string;
  let senderSeed: Uint8Array;

  beforeEach(() => {
    const recipientSeed = seedFromMnemonic(RECIPIENT_MNEMONIC);
    senderSeed = seedFromMnemonic(SENDER_MNEMONIC);
    recipientAddr = stacksAdapter.deriveAddress(recipientSeed);
    senderAddr = stacksAdapter.deriveAddress(senderSeed);

    // Opening balances, in sBTC base units (sats).
    ledger = new Map([
      [senderAddr, 100_000n],
      [recipientAddr, 5_000n],
    ]);
    txs = new Map();
    let nonce = 0;

    vi.spyOn(stacksAdapter, 'balanceOf').mockImplementation(
      async (_asset, address) => ledger.get(address) ?? 0n,
    );

    vi.spyOn(stacksAdapter, 'send').mockImplementation(async (seed, req) => {
      const from = stacksAdapter.deriveAddress(seed);
      const bal = ledger.get(from) ?? 0n;
      if (bal < req.amount) throw new Error('insufficient balance');
      ledger.set(from, bal - req.amount);
      ledger.set(req.recipient, (ledger.get(req.recipient) ?? 0n) + req.amount);
      const txid = `mocktx${(++nonce).toString().padStart(2, '0')}`;
      txs.set(txid, { from, to: req.recipient, amount: req.amount, asset: req.asset.assetId });
      return txid;
    });

    vi.spyOn(stacksAdapter, 'verify').mockImplementation(async (params) => {
      const tx = txs.get(params.txid);
      if (!tx) return { found: false, confirmed: false, matches: false, detail: 'tx not found' };
      const matches =
        tx.to === params.recipient &&
        tx.amount === params.amount &&
        tx.asset === params.asset.assetId;
      return { found: true, confirmed: true, matches, detail: matches ? 'confirmed' : 'fields mismatch' };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zaps the author and the zap verifies against their signed advertisement', async () => {
    const ZAP = 2_500n;
    const recipientStart = await stacksAdapter.balanceOf(sbtc, recipientAddr);

    // 1. AUTHOR publishes a signed kind:10021 advertising sBTC + their address.
    const authorSk = generateSecretKey();
    const authorPk = getPublicKey(authorSk);
    const adEvent = sign(
      buildAcceptEvent({
        accepts: [
          {
            asset: sbtc.assetId,
            account: `stacks:1:${recipientAddr}`,
            transferType: sbtc.transferType,
          },
        ],
        relays: ['wss://relay.example'],
      }),
      authorSk,
      1_740_000_000,
    );
    expect(adEvent.kind).toBe(10021);

    // 2. SENDER discovers the advertisement (real parser + chain-match check).
    const advertisement = parseAcceptEvent(adEvent);
    expect(advertisement.accepts).toHaveLength(1);
    expect(advertisement.accepts[0].asset).toBe(sbtc.assetId);

    // 3. SENDER pushes the on-chain payment to the advertised address.
    const txid = await stacksAdapter.send(senderSeed, {
      asset: sbtc,
      recipient: recipientAddr,
      amount: ZAP,
    });

    // 4. SENDER signs the kind:9734 and publishes a signed kind:9735 receipt.
    const senderSk = generateSecretKey();
    const now = 1_740_000_100;
    const orderId = makeOrderId(adEvent.id, now);
    const signedRequest = sign(
      buildZapRequest({
        recipientPubkey: authorPk,
        eventId: 'note-being-zapped',
        relays: advertisement.relays,
        assetId: sbtc.assetId,
        transferType: sbtc.transferType,
        recipientAddress: recipientAddr,
        amount: ZAP,
        comment: 'gm — zapped in sBTC',
        orderId,
        now,
      }),
      senderSk,
      now,
    );
    const caip358Receipt: Caip358Receipt = {
      version: 1,
      orderId,
      asset: sbtc.assetId,
      amount: `0x${ZAP.toString(16)}`,
      recipient: recipientAddr,
      sender: senderAddr,
      txid,
      status: 'pending',
    };
    const receiptEvent = sign(
      buildZapReceipt({
        recipientPubkey: authorPk,
        senderPubkey: getPublicKey(senderSk),
        eventId: 'note-being-zapped',
        requestJson: JSON.stringify(signedRequest),
        network: sbtc.caip2,
        assetId: sbtc.assetId,
        txid,
        receipt: caip358Receipt,
      }),
      senderSk,
      now + 1,
    );

    // 5. Anyone verifies the receipt against the AUTHOR's signed 10021 (trust anchor).
    const verification = await verifyZapReceipt(receiptEvent, advertisement);
    expect(verification.status).toBe('verified');
    expect(verification.amount).toBe(ZAP);
    expect(verification.recipientAddress).toBe(recipientAddr);
    expect(verification.txid).toBe(txid);

    // 6. The author's on-chain balance went up by exactly the zap amount.
    const recipientEnd = await stacksAdapter.balanceOf(sbtc, recipientAddr);
    expect(recipientEnd - recipientStart).toBe(ZAP);
    expect(recipientEnd).toBe(5_000n + ZAP);
  });

  it('refuses to verify a payment to an address the author never advertised', async () => {
    const ZAP = 1_000n;

    // Author advertises ONLY recipientAddr.
    const authorSk = generateSecretKey();
    const authorPk = getPublicKey(authorSk);
    const adEvent = sign(
      buildAcceptEvent({
        accepts: [
          { asset: sbtc.assetId, account: `stacks:1:${recipientAddr}`, transferType: sbtc.transferType },
        ],
        relays: [],
      }),
      authorSk,
      1_740_000_000,
    );
    const advertisement = parseAcceptEvent(adEvent);

    // Sender pays a DIFFERENT, unadvertised address (senderAddr stands in for an attacker-supplied one).
    const unadvertised = senderAddr;
    const txid = await stacksAdapter.send(senderSeed, { asset: sbtc, recipient: unadvertised, amount: ZAP });

    const senderSk = generateSecretKey();
    const now = 1_740_000_100;
    const orderId = makeOrderId(adEvent.id, now);
    const signedRequest = sign(
      buildZapRequest({
        recipientPubkey: authorPk,
        eventId: 'note-being-zapped',
        relays: [],
        assetId: sbtc.assetId,
        transferType: sbtc.transferType,
        recipientAddress: unadvertised,
        amount: ZAP,
        comment: '',
        orderId,
        now,
      }),
      senderSk,
      now,
    );
    const receiptEvent = sign(
      buildZapReceipt({
        recipientPubkey: authorPk,
        senderPubkey: getPublicKey(senderSk),
        eventId: 'note-being-zapped',
        requestJson: JSON.stringify(signedRequest),
        network: sbtc.caip2,
        assetId: sbtc.assetId,
        txid,
        receipt: {
          version: 1,
          orderId,
          asset: sbtc.assetId,
          amount: `0x${ZAP.toString(16)}`,
          recipient: unadvertised,
          sender: senderAddr,
          txid,
          status: 'pending',
        },
      }),
      senderSk,
      now + 1,
    );

    const verification = await verifyZapReceipt(receiptEvent, advertisement);
    // The funds moved on-chain, but the address was never advertised → not trusted.
    expect(verification.status).toBe('unadvertised');
  });
});
