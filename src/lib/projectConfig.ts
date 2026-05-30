// Single source of truth for the hackathon project values shown on the page
// and used for NIP-25 reaction tagging. Replace the placeholder constants
// below with the actual nostr event posted from the iOS app before deploying.

/** Hex event id of the hackathon announcement note posted from the iOS app. */
export const PROJECT_EVENT_ID = '0000000000000000000000000000000000000000000000000000000000000000';

/** Hex pubkey of whoever posted PROJECT_EVENT_ID (the iOS app identity). */
export const PROJECT_AUTHOR_PUBKEY = '0000000000000000000000000000000000000000000000000000000000000000';

export const PROJECT_NAME = 'passnokkel';
export const PROJECT_TAGLINE = 'A Nostr identity from a passkey';
export const PROJECT_DESCRIPTION =
  'A cross-platform demo of the Breez Passkey Login spec v0.9.1: derive your Nostr identity from a single passkey, with no seed phrase to copy and no extension to install. Sign in on this website or on the companion iOS app and you get the same npub — proven below by a one-tap thumbs-up.';

export const HACKATHON = 'And Other Stuff';

/** Optional links surfaced on the showcase page. Leave empty to hide. */
export const IOS_APP_URL = '';
export const SPEC_URL = 'https://gist.github.com/pretyflaco/bc4eaf35b4a05d5d52906b2d2d6ed585';
export const REPO_URL = '';

/** What content to put on the kind-7 reaction event. */
export const REACTION_CONTENT = '👍';
