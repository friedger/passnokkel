// Hackathon project configuration. The upvote target is a single bech32
// `nevent1...` (or `note1...`) string — change PROJECT_NEVENT to point the
// site at a different note, no manual hex copy-paste required.

import { nip19 } from 'nostr-tools';

/**
 * The bech32 identifier of the note people are upvoting. Can be either:
 * - `nevent1...` (preferred — carries author pubkey + relay hints), or
 * - `note1...`  (id only — author falls back to empty `p` tag).
 *
 * Swap this string to target a different post.
 */
export const PROJECT_NEVENT =
  'nevent1qqszlz0a60qytkq0x5rqxu0z9skpmcg0e3eec8fx8hmwuq4mym23a3qpz3mhxue69uhhyetvv9ujuerpd46hxtnfduqs6amnwvaz7tmwdaejumr0dsq3vamnwvaz7tmjv4kxz7fwwpexjmtpdshxuet5qgsd8vclzl45glgsjcej0a9kyf7qnfarw7kh58mtu8z6t3qlrc82ydqrqsqqqqqpm7j7a6';

interface ProjectTarget {
  eventId: string;
  authorPubkey: string;
  relayHints: string[];
}

function decodeProjectTarget(bech32: string): ProjectTarget {
  try {
    const decoded = nip19.decode(bech32);
    if (decoded.type === 'nevent') {
      return {
        eventId: decoded.data.id,
        authorPubkey: decoded.data.author ?? '',
        relayHints: decoded.data.relays ?? [],
      };
    }
    if (decoded.type === 'note') {
      return { eventId: decoded.data, authorPubkey: '', relayHints: [] };
    }
    throw new Error(`Unsupported PROJECT_NEVENT type: ${decoded.type}`);
  } catch (err) {
    console.error('Invalid PROJECT_NEVENT — reactions disabled.', err);
    return { eventId: '', authorPubkey: '', relayHints: [] };
  }
}

const target = decodeProjectTarget(PROJECT_NEVENT);

/** Hex event id of the note the 👍 references. Empty string disables reactions. */
export const PROJECT_EVENT_ID = target.eventId;
/** Hex pubkey of the note's author. Used as the NIP-25 `p` tag. */
export const PROJECT_AUTHOR_PUBKEY = target.authorPubkey;
/** Relay hints embedded in the nevent (informational; the pool uses APP_RELAYS). */
export const PROJECT_RELAY_HINTS = target.relayHints;

/**
 * The note people can zap — separate from the upvote target above. Zaps and
 * their boosted-upvote reactions reference THIS event.
 */
export const PROJECT_ZAP_NEVENT =
  'nevent1qqsvwk7rnrdsuyjzpmryf3pq6en693p5q638pwu0lumsqarqhcgmq4q44a0wc';

const zapTarget = decodeProjectTarget(PROJECT_ZAP_NEVENT);

/** Hex event id of the note being zapped. Empty string disables zaps. */
export const PROJECT_ZAP_EVENT_ID = zapTarget.eventId;
/**
 * Hex pubkey of the zap target's author — the zap recipient and kind:10021
 * advertiser. The nevent above carries only the id, so the author is pinned
 * here explicitly (resolved from relays).
 */
export const PROJECT_ZAP_AUTHOR_PUBKEY =
  zapTarget.authorPubkey || 'c9e30a01be5de6144dd5199a7b5798357c552d438c6091edcf9a15e4475dde6b';
/** npub of the zap target's author, for an njump profile link. */
export const PROJECT_ZAP_AUTHOR_NPUB = PROJECT_ZAP_AUTHOR_PUBKEY
  ? nip19.npubEncode(PROJECT_ZAP_AUTHOR_PUBKEY)
  : '';

export const PROJECT_NAME = 'passnokkel';
export const PROJECT_TAGLINE = 'A Nostr identity from a passkey';
export const PROJECT_DESCRIPTION =
  'A cross-platform demo of the Breez Passkey Login spec v0.9.1: derive your Nostr identity from a single passkey, with no seed phrase to copy and no extension to install.';

export const HACKATHON = 'And Other Stuff';

/** Optional links surfaced on the showcase page. Leave empty to hide. */
export const IOS_APP_URL = 'https://github.com/schjonhaug/nostr-passkey-poc';
export const SPEC_URL = 'https://github.com/breez/passkey-login/blob/main/spec.md';
export const REPO_URL = 'https://github.com/friedger/passnokkel';

/** Chain-Agnostic Zaps NIP (NIP-57 + CAIP-358) and its serverless kind:10021
 * acceptance-advertisement companion, published over Nostr via ngit (NIP-34). */
export const CAIPZAPS_NIP_URL =
  'https://gitworkshop.dev/npub1e83s5qd7thnpgnw4rxd8k4ucx4792t2r33sfrmw0ng27g36ame4sfyfv8d/relay.damus.io/nip-caip358-zaps';

/** Links shown on the presentation deck. Fill these in before presenting. */
export const HORCRUXBACKUP_ISSUE_URL = 'https://github.com/mplorentz/horcrux/issues/245';
export const DITTO_PR_URL = 'https://gitworkshop.dev/npub1hlw2enn647n0dc04l4tydv44n4s7z83f9vhz6dpe4qzfwq39jp8swu9ecz/ditto';
export const TREASURES_PR_URL = 'https://gitworkshop.dev/npub1hlw2enn647n0dc04l4tydv44n4s7z83f9vhz6dpe4qzfwq39jp8swu9ecz/treasures';
export const CHORUS_PR_URL = 'https://gitworkshop.dev/npub1hlw2enn647n0dc04l4tydv44n4s7z83f9vhz6dpe4qzfwq39jp8swu9ecz/relay.ngit.dev/chorus-collective/prs/nevent1qy28wumn8ghj7un9d3shjtnwva5hgtnyv4mqqg9qc5c785xpz53tff9vv5scf5ffer5pywyv7vgvwakugg6ecsus6sdzl6qp';
export const CASHU_ISSUE_URL = 'https://github.com/cashubtc/cashu.me/issues/528';

/** What content to put on the kind-7 reaction event. */
export const REACTION_CONTENT = '👍';
