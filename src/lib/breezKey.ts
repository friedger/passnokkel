// Breez Passkey Login spec v0.9.1 key derivation.
//
//   PRF(passkey, MAGIC_BYTES)  →  account_master  →  nostr_account   (m/44'/1237'/55'/0/0)
//   PRF(passkey, salt_string)  →  root_key        →  nostr_identity  (m/44'/1237'/0'/0/0)
//
// nostr_account signs salt advertisements only. nostr_identity signs user-
// facing events (notes, reactions). One identity per salt.

import { HDKey } from '@scure/bip32';
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { getPublicKey, nip19 } from 'nostr-tools';

/** The fixed salt this site uses to derive its nostr_identity. */
export const RECEPTION_SALT = 'passnokkel:v1';

const PATH_ACCOUNT = "m/44'/1237'/55'/0/0";
const PATH_IDENTITY = "m/44'/1237'/0'/0/0";

export interface DerivedKey {
  sk: Uint8Array;
  pubkey: string;
  nsec: string;
}

function prfToHDKey(prf: Uint8Array, path: string): Uint8Array {
  // PRF output is 32 bytes; that's the BIP39 entropy budget for a 24-word
  // mnemonic. Going through the mnemonic step (rather than using PRF bytes
  // directly as a seed) keeps us NIP-06 compatible — same entropy in either
  // an iOS-side or web-side derivation yields the same nostr key.
  if (prf.length !== 32) throw new Error(`expected 32-byte PRF, got ${prf.length}`);
  const mnemonic = entropyToMnemonic(prf, wordlist);
  const seed = mnemonicToSeedSync(mnemonic);
  const node = HDKey.fromMasterSeed(seed).derive(path);
  if (!node.privateKey) throw new Error('Derivation produced no private key');
  return node.privateKey;
}

function packKey(sk: Uint8Array): DerivedKey {
  return { sk, pubkey: getPublicKey(sk), nsec: nip19.nsecEncode(sk) };
}

/** Salt-registry account. Used to sign kind-1 salt advertisements only. */
export function deriveNostrAccount(prfFromMagic: Uint8Array): DerivedKey {
  return packKey(prfToHDKey(prfFromMagic, PATH_ACCOUNT));
}

/** Signing identity for a given salt. This is what posts reactions, notes, etc. */
export function deriveNostrIdentity(prfFromSalt: Uint8Array): DerivedKey {
  return packKey(prfToHDKey(prfFromSalt, PATH_IDENTITY));
}
