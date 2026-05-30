// Deterministic random profile for new passkey users. The same pubkey always
// produces the same name + avatar — so a user landing on the page from a
// different device sees a stable identity, not a fresh randomization each
// time. Users can overwrite either field from any Nostr client later.

const ADJECTIVES = [
  'Curious', 'Brave', 'Quiet', 'Sunny', 'Wild', 'Clever', 'Lucky', 'Bold',
  'Gentle', 'Mighty', 'Jolly', 'Witty', 'Stoic', 'Cheery', 'Nimble', 'Plucky',
  'Sleepy', 'Eager', 'Honest', 'Cosmic', 'Velvet', 'Electric', 'Polite', 'Hazy',
];

const NOUNS = [
  'Otter', 'Falcon', 'Badger', 'Heron', 'Lynx', 'Magpie', 'Beaver', 'Hare',
  'Wombat', 'Puffin', 'Cricket', 'Stoat', 'Robin', 'Fennec', 'Pangolin',
  'Capybara', 'Marten', 'Tapir', 'Ibex', 'Gecko', 'Newt', 'Sparrow', 'Bison',
  'Quokka',
];

function pickFromHex(hex: string, offset: number, len: number, modulus: number): number {
  const slice = hex.slice(offset, offset + len);
  const n = parseInt(slice, 16);
  return Number.isFinite(n) ? n % modulus : 0;
}

export interface RandomProfile {
  name: string;
  picture: string;
  /** Filled in so other clients don't leave it blank. */
  display_name: string;
}

/**
 * Deterministic from `pubkey`. Picture is a DiceBear `thumbs` SVG —
 * matches the site's hand-up theme and renders without any image binary
 * having to land on the relay.
 */
export function generateRandomProfile(pubkey: string): RandomProfile {
  const hex = pubkey.startsWith('npub') ? pubkey : pubkey.toLowerCase();
  const adj = ADJECTIVES[pickFromHex(hex, 0, 8, ADJECTIVES.length)];
  const noun = NOUNS[pickFromHex(hex, 8, 8, NOUNS.length)];
  const name = `${adj} ${noun}`;
  const picture = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(hex)}`;
  return { name, display_name: name, picture };
}
