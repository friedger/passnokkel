// Zap verification — the trust path the spec insists on baking in early.
//
// For each kind:9735 receipt we:
//   1. decode the embedded kind:9734 (the `description` tag),
//   2. confirm the receipt's asset + recipient address match an `accept` entry
//      in the recipient's signed kind:10021 — the ONLY trusted source of the
//      address; never an address from the receipt or request alone,
//   3. query the chain for the txid and confirm sender/recipient/asset/amount
//      and finality.
//
// The recipient's advertisement is fetched by the caller (a hook) and passed in
// so this module stays free of Nostr I/O and easy to reason about.

import type { NostrEvent } from '@nostrify/nostrify';

import { findAssetByCaip19, type ZapAsset } from './assets';
import { accountAddress, parseZapReceipt, type Advertisement, type Caip358Request } from './events';

export type ZapStatus =
  | 'verified' // advertised, on-chain, confirmed, all fields match
  | 'pending' // on-chain but not yet confirmed
  | 'mismatch' // on-chain but asset/recipient/amount disagree
  | 'unadvertised' // address/asset not in the recipient's signed 10021 (trust fail)
  | 'unverifiable'; // tx missing, unknown asset, or chain/API error

export interface ZapVerification {
  status: ZapStatus;
  detail: string;
  asset?: ZapAsset;
  /** Amount in base units. */
  amount?: bigint;
  recipientAddress?: string;
  txid?: string;
  explorerUrl?: string;
  senderPubkey?: string;
  recipientPubkey?: string;
}

function fail(status: ZapStatus, detail: string, partial: Partial<ZapVerification> = {}): ZapVerification {
  return { status, detail, ...partial };
}

export async function verifyZapReceipt(
  receipt: NostrEvent,
  advertisement: Advertisement | null,
): Promise<ZapVerification> {
  const parsed = parseZapReceipt(receipt);
  const base: Partial<ZapVerification> = {
    senderPubkey: parsed.senderPubkey,
    recipientPubkey: parsed.recipientPubkey,
    txid: parsed.txid,
  };

  if (parsed.paymentType !== 'caip358') {
    return fail('unverifiable', 'Not a CAIP-358 zap receipt.', base);
  }
  if (!parsed.request) {
    return fail('unverifiable', 'Receipt is missing the original zap request.', base);
  }
  if (!parsed.txid) {
    return fail('unverifiable', 'Receipt has no txid to verify.', base);
  }

  // Decode the CAIP-358 payment option from the embedded 9734.
  const reqTag = parsed.request.tags?.find((t) => t[0] === 'caip358_request')?.[1];
  if (!reqTag) return fail('unverifiable', 'Zap request has no CAIP-358 payload.', base);
  let request: Caip358Request;
  try {
    request = JSON.parse(reqTag) as Caip358Request;
  } catch {
    return fail('unverifiable', 'Malformed CAIP-358 request payload.', base);
  }
  const option = request.paymentOptions?.[0];
  if (!option) return fail('unverifiable', 'Zap request has no payment option.', base);

  // The receipt's top-level asset tag must agree with the request it embeds.
  if (parsed.assetId && parsed.assetId !== option.asset) {
    return fail('mismatch', 'Receipt asset disagrees with the zap request.', base);
  }

  const asset = findAssetByCaip19(option.asset);
  if (!asset) return fail('unverifiable', `Unknown or unsupported asset: ${option.asset}`, base);
  base.asset = asset;
  base.explorerUrl = asset.adapter.explorerTx(parsed.txid);

  let amount: bigint;
  try {
    amount = BigInt(option.amount); // hex "0x.." or decimal
  } catch {
    return fail('unverifiable', 'Malformed amount in zap request.', base);
  }
  base.amount = amount;
  base.recipientAddress = option.recipient;

  // ── TRUST ANCHOR ──────────────────────────────────────────────────────────
  // The recipient must have advertised this exact asset + receive address in
  // their signed 10021. An address from the receipt/request alone is not trusted.
  if (!advertisement) {
    return fail('unadvertised', "Recipient has no acceptance advertisement (kind:10021).", base);
  }
  const advertised = advertisement.accepts.some(
    (a) => a.asset === option.asset && accountAddress(a.account) === option.recipient,
  );
  if (!advertised) {
    return fail(
      'unadvertised',
      'Recipient never advertised this asset + address — refusing to trust it.',
      base,
    );
  }

  // ── ON-CHAIN CHECK ──────────────────────────────────────────────────────────
  let result;
  try {
    result = await asset.adapter.verify({
      asset,
      txid: parsed.txid,
      recipient: option.recipient,
      amount,
    });
  } catch (err) {
    return fail('unverifiable', `Chain query failed: ${err instanceof Error ? err.message : String(err)}`, base);
  }

  if (!result.found) return fail('unverifiable', result.detail, base);
  if (!result.matches) return fail('mismatch', result.detail, base);
  if (!result.confirmed) return fail('pending', result.detail, base);
  return { status: 'verified', detail: result.detail, ...base };
}
