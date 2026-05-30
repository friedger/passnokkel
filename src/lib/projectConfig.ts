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
  'nevent1qqsdpen88vy3aq8lxetv8cf55eja2w3jthmk53zy36wtjqntvtee0rspz3mhxue69uhhyetvv9ujuerpd46hxtnfduqs6amnwvaz7tmwdaejumr0dsq3vamnwvaz7tmjv4kxz7fwwpexjmtpdshxuet5qgs8j7scdgg7q86692glw6ucy8rnyu3mqk92q0z3ugksfla80n9735srqsqqqqqpesdr5w';

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

export const PROJECT_NAME = 'passnokkel';
export const PROJECT_TAGLINE = 'A Nostr identity from a passkey';
export const PROJECT_DESCRIPTION =
  'A cross-platform demo of the Breez Passkey Login spec v0.9.1: derive your Nostr identity from a single passkey, with no seed phrase to copy and no extension to install.';

export const HACKATHON = 'And Other Stuff';

/** Optional links surfaced on the showcase page. Leave empty to hide. */
export const IOS_APP_URL = '';
export const SPEC_URL = 'https://gist.github.com/pretyflaco/bc4eaf35b4a05d5d52906b2d2d6ed585';
export const REPO_URL = '';

/** What content to put on the kind-7 reaction event. */
export const REACTION_CONTENT = '👍';
