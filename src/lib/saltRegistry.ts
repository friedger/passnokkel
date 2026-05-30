// Breez Passkey Login spec v0.9.1 — Nostr Salt Registry.
//
// Each salt the user has ever used is published as a plain kind-1 event signed
// by the salt-registry account (nostr_account, derived from MAGIC_BYTES). On
// restore, listing these events recovers the set of salts so all sub-keys can
// be re-derived from the same passkey.
//
// We add an optional `['t', 'breez-salt']` tag so the registry can be queried
// without false positives from regular notes the account may have posted.
// The spec deliberately calls for plain kind-1 events (plausible deniability);
// this tag is a pragmatic deviation for a demo where discoverability beats
// deniability. To match the strict spec, drop the tag.

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { NSecSigner } from '@nostrify/nostrify';

const SALT_TAG = 'breez-salt';

/** Minimal subset of NPool we actually need — keeps tests easier to fake. */
interface Pool {
  req(filters: NostrFilter[], opts?: { signal?: AbortSignal }): AsyncIterable<
    ['EVENT', string, NostrEvent] | ['EOSE', string] | ['CLOSED', string, string]
  >;
  event(event: NostrEvent, opts?: { signal?: AbortSignal }): Promise<unknown>;
}

/** Drain a REQ until EOSE, returning all event payloads. */
async function collectUntilEose(pool: Pool, filter: NostrFilter, signal: AbortSignal): Promise<NostrEvent[]> {
  const events: NostrEvent[] = [];
  for await (const msg of pool.req([filter], { signal })) {
    if (msg[0] === 'EVENT') events.push(msg[2]);
    if (msg[0] === 'EOSE' || msg[0] === 'CLOSED') break;
  }
  return events;
}

/** List the salts that `accountPubkey` has previously advertised. */
export async function listSalts(pool: Pool, accountPubkey: string): Promise<string[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const events = await collectUntilEose(
      pool,
      { kinds: [1], authors: [accountPubkey], '#t': [SALT_TAG] },
      ctrl.signal,
    );
    return events.map((e) => e.content);
  } finally {
    clearTimeout(timer);
  }
}

/** Publish a salt advertisement signed by the nostr_account. */
export async function advertiseSalt(pool: Pool, accountSk: Uint8Array, salt: string): Promise<NostrEvent> {
  const signer = new NSecSigner(accountSk);
  const event = await signer.signEvent({
    kind: 1,
    content: salt,
    tags: [['t', SALT_TAG]],
    created_at: Math.floor(Date.now() / 1000),
  });
  await pool.event(event, { signal: AbortSignal.timeout(5000) });
  return event;
}

/** Publish `salt` if the account hasn't already. No-op on subsequent calls. */
export async function ensureSaltAdvertised(pool: Pool, accountSk: Uint8Array, salt: string): Promise<void> {
  const signer = new NSecSigner(accountSk);
  const pubkey = await signer.getPublicKey();
  const known = await listSalts(pool, pubkey);
  if (known.includes(salt)) return;
  await advertiseSalt(pool, accountSk, salt);
}
