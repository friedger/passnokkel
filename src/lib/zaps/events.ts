// NIP-57 + CAIP-358 zap events, plus the companion advertisement (kind:10020).
//
//   kind:10020  acceptance advertisement — what assets/addresses a user accepts
//   kind:9734   zap request — sender's intent + a CAIP-358 payment request
//   kind:9735   zap receipt — published by the sender for PUSH payments
//
// NOTE: 10020 is PROVISIONAL. The companion-NIP PR may land on a different
// number; coordinate before shipping (see NIP.md). Treat it as a single source
// of truth here so a later change is a one-line edit.

import type { NostrEvent } from '@nostrify/nostrify';

import { chainsMatch, parseAccountId, parseAssetId } from './caip';

export const KIND_ZAP_ACCEPT = 10020;
export const KIND_ZAP_REQUEST = 9734;
export const KIND_ZAP_RECEIPT = 9735;

/** Event template understood by useNostrPublish. */
export type ZapEventTemplate = Pick<NostrEvent, 'kind' | 'content'> &
  Partial<Pick<NostrEvent, 'tags' | 'created_at'>>;

// ── kind:10020 — acceptance advertisement ───────────────────────────────────

export interface AcceptEntry {
  /** CAIP-19 asset id. */
  asset: string;
  /** CAIP-10 account (chain + receive address). */
  account: string;
  /** CAIP-358 transfer type, e.g. "sip10-transfer". */
  transferType: string;
}

export interface Advertisement {
  accepts: AcceptEntry[];
  relays: string[];
  lud16?: string;
}

export function buildAcceptEvent(ad: Advertisement): ZapEventTemplate {
  const tags: string[][] = [
    ['alt', 'Chain-agnostic zap acceptance (NIP-57 + CAIP-358)'],
    ...ad.relays.map((r) => ['relay', r]),
    ...ad.accepts.map((a) => ['accept', a.asset, a.account, a.transferType]),
  ];
  if (ad.lud16) tags.push(['lud16', ad.lud16]);
  return { kind: KIND_ZAP_ACCEPT, content: '', tags };
}

/**
 * Parse a 10020, dropping any `accept` entry whose CAIP-19 chain doesn't match
 * its CAIP-10 chain — the spec's first trust check, applied at the source.
 */
export function parseAcceptEvent(event: NostrEvent): Advertisement {
  const accepts: AcceptEntry[] = [];
  const relays: string[] = [];
  let lud16: string | undefined;

  for (const tag of event.tags) {
    if (tag[0] === 'relay' && tag[1]) relays.push(tag[1]);
    else if (tag[0] === 'lud16' && tag[1]) lud16 = tag[1];
    else if (tag[0] === 'accept' && tag[1] && tag[2] && tag[3]) {
      const asset = parseAssetId(tag[1]);
      const account = parseAccountId(tag[2]);
      if (asset && account && chainsMatch(asset, account)) {
        accepts.push({ asset: tag[1], account: tag[2], transferType: tag[3] });
      }
    }
  }
  return { accepts, relays, lud16 };
}

/** The receive address from a CAIP-10 account (the part after the chain id). */
export function accountAddress(caip10: string): string | null {
  return parseAccountId(caip10)?.address ?? null;
}

// ── kind:9734 — zap request (CAIP-358) ──────────────────────────────────────

export interface Caip358PaymentOption {
  asset: string;
  /** Hex-encoded base-unit amount, e.g. "0x64". */
  amount: string;
  recipient: string;
  types: string[];
}

export interface Caip358Request {
  version: 1;
  orderId: string;
  expiry: number;
  paymentOptions: Caip358PaymentOption[];
}

export interface ZapRequestInput {
  recipientPubkey: string;
  eventId: string;
  relays: string[];
  assetId: string;
  transferType: string;
  recipientAddress: string;
  /** Amount in base units. */
  amount: bigint;
  comment: string;
  orderId: string;
  /** Unix seconds. */
  now: number;
  /** Optional kind-7 reaction this zap boosts. */
  reactionId?: string;
}

export function buildCaip358Request(input: ZapRequestInput): Caip358Request {
  return {
    version: 1,
    orderId: input.orderId,
    expiry: input.now + 300,
    paymentOptions: [
      {
        asset: input.assetId,
        amount: `0x${input.amount.toString(16)}`,
        recipient: input.recipientAddress,
        types: [input.transferType],
      },
    ],
  };
}

export function buildZapRequest(input: ZapRequestInput): ZapEventTemplate {
  const tags: string[][] = [
    ['relays', ...input.relays],
    ['amount', input.amount.toString()],
    ['p', input.recipientPubkey],
    ['e', input.eventId],
    ['payment_type', 'caip358'],
    ['caip358_request', JSON.stringify(buildCaip358Request(input))],
  ];
  // Link the zap to the emoji reaction it boosts (NIP-57 allows extra e-tags).
  if (input.reactionId) tags.push(['e', input.reactionId, '', 'reaction']);
  return { kind: KIND_ZAP_REQUEST, content: input.comment, tags };
}

// ── kind:9735 — zap receipt (CAIP-358) ──────────────────────────────────────

export interface Caip358Receipt {
  version: 1;
  orderId: string;
  asset: string;
  amount: string;
  recipient: string;
  sender: string;
  txid: string;
  status: 'confirmed' | 'pending';
}

export interface ZapReceiptInput {
  recipientPubkey: string;
  senderPubkey: string;
  eventId: string;
  /** JSON string of the signed kind:9734. */
  requestJson: string;
  network: string;
  assetId: string;
  txid: string;
  receipt: Caip358Receipt;
}

export function buildZapReceipt(input: ZapReceiptInput): ZapEventTemplate {
  return {
    kind: KIND_ZAP_RECEIPT,
    content: '',
    tags: [
      ['p', input.recipientPubkey],
      ['P', input.senderPubkey],
      ['e', input.eventId],
      // Keep an empty bolt11 so NIP-57 clients that require the tag don't choke.
      ['bolt11', ''],
      ['description', input.requestJson],
      ['payment_type', 'caip358'],
      ['network', input.network],
      ['txid', input.txid],
      ['asset', input.assetId],
      ['caip358_receipt', JSON.stringify(input.receipt)],
    ],
  };
}

export interface ParsedReceipt {
  recipientPubkey?: string;
  senderPubkey?: string;
  eventId?: string;
  paymentType?: string;
  network?: string;
  txid?: string;
  assetId?: string;
  /** The decoded kind:9734 from the `description` tag. */
  request?: NostrEvent;
  caip358Receipt?: Caip358Receipt;
}

function tag(event: NostrEvent, name: string): string | undefined {
  return event.tags.find((t) => t[0] === name)?.[1];
}

export function parseZapReceipt(event: NostrEvent): ParsedReceipt {
  const description = tag(event, 'description');
  let request: NostrEvent | undefined;
  if (description) {
    try {
      request = JSON.parse(description) as NostrEvent;
    } catch {
      request = undefined;
    }
  }
  const receiptJson = tag(event, 'caip358_receipt');
  let caip358Receipt: Caip358Receipt | undefined;
  if (receiptJson) {
    try {
      caip358Receipt = JSON.parse(receiptJson) as Caip358Receipt;
    } catch {
      caip358Receipt = undefined;
    }
  }
  return {
    recipientPubkey: tag(event, 'p'),
    senderPubkey: event.tags.find((t) => t[0] === 'P')?.[1],
    eventId: tag(event, 'e'),
    paymentType: tag(event, 'payment_type'),
    network: tag(event, 'network'),
    txid: tag(event, 'txid'),
    assetId: tag(event, 'asset'),
    request,
    caip358Receipt,
  };
}

/** Generate a unique CAIP-358 orderId for replay protection. */
export function makeOrderId(eventId: string, now: number): string {
  const rand = bytesToHex(crypto.getRandomValues(new Uint8Array(6)));
  return `zap-${eventId.slice(0, 8)}-${now}-${rand}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
