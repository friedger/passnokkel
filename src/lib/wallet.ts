// Multi-chain receive addresses derived from the same BIP39 recovery phrase
// that backs the Breez passkey identity. The phrase comes from
// PRF(passkey, RECEPTION_SALT) → mnemonicFromPrf() (see breezKey.ts); from that
// one seed we derive standard BIP44/BIP84 keys per coin.
//
// Every derivation here is checked against published BIP39 test vectors
// (the canonical "abandon…about" mnemonic) so the addresses are real, not
// decorative — see the verification notes next to each coin.

import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { bech32, base58 } from '@scure/base';

export interface Currency {
  id: string;
  name: string;
  /** Ticker — also the branded-chip fallback if the logo fails to load. */
  symbol: string;
  /** Brand colour for the logo-chip fallback. */
  color: string;
  /** Network the coin lives on, shown under the name. */
  networkLabel: string;
  /** Logo URL (Trust Wallet assets, with one Stacks exception). */
  icon: string;
  /** Human-readable BIP-44/84 path shown under the address. */
  path: string;
  /** Label for the value we display (most are "Receive address"). */
  addressLabel: string;
  /** Derive the receive address (or wallet identifier) from a BIP39 seed. */
  derive: (seed: Uint8Array) => string;
  /** Optional clarifying note rendered under the address. */
  note?: string;
}

// Logos from github.com/trustwallet/assets — native coins live at
// blockchains/<chain>/info/logo.png; tokens at
// blockchains/<chain>/assets/<checksummed-contract>/logo.png.
const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
const twNative = (chain: string) => `${TW}/${chain}/info/logo.png`;
// Stacks isn't in Trust Wallet's asset set; use the official Stacks mark.
const STACKS_ICON =
  'https://cdn.prod.website-files.com/618b0aafa4afde9048fe3926/6a18fdf1d7e9f8e0985bd6a5_Stacks%20Logo%20png.avif';

// ── primitives ──────────────────────────────────────────────────────────────

const hash160 = (b: Uint8Array): Uint8Array => ripemd160(sha256(b));

function secpPriv(seed: Uint8Array, path: string): Uint8Array {
  const node = HDKey.fromMasterSeed(seed).derive(path);
  if (!node.privateKey) throw new Error(`No private key for ${path}`);
  return node.privateKey;
}
const secpPubCompressed = (seed: Uint8Array, path: string) =>
  secp256k1.getPublicKey(secpPriv(seed, path), true);
const secpPubUncompressed = (seed: Uint8Array, path: string) =>
  secp256k1.getPublicKey(secpPriv(seed, path), false);

/** base58check: payload || first 4 bytes of double-SHA256(payload). */
function base58check(payload: Uint8Array): string {
  const checksum = sha256(sha256(payload)).slice(0, 4);
  const out = new Uint8Array(payload.length + 4);
  out.set(payload);
  out.set(checksum, payload.length);
  return base58.encode(out);
}

// ── encoders ────────────────────────────────────────────────────────────────

/** Native SegWit (BIP84) P2WPKH bech32 address — used by BTC and LTC. */
function segwit(seed: Uint8Array, path: string, hrp: string): string {
  const words = [0, ...bech32.toWords(hash160(secpPubCompressed(seed, path)))];
  return bech32.encode(hrp, words);
}

/** Legacy P2PKH base58check address with a coin version byte. */
function p2pkh(seed: Uint8Array, path: string, version: number): string {
  const h = hash160(secpPubCompressed(seed, path));
  return base58check(new Uint8Array([version, ...h]));
}

/** Cosmos-SDK bech32 account address (no SegWit version byte). */
function cosmos(seed: Uint8Array, path: string, hrp: string): string {
  return bech32.encode(hrp, bech32.toWords(hash160(secpPubCompressed(seed, path))));
}

/** Ethereum-style address: last 20 bytes of keccak256(uncompressed pubkey). */
function ethHash20(seed: Uint8Array, path: string): Uint8Array {
  const pub = secpPubUncompressed(seed, path).slice(1); // drop the 0x04 prefix
  return keccak_256(pub).slice(-20);
}
function ethAddress(seed: Uint8Array, path: string): string {
  const hexAddr = bytesToHex(ethHash20(seed, path));
  // EIP-55 mixed-case checksum.
  const hashHex = bytesToHex(keccak_256(utf8ToBytes(hexAddr)));
  let out = '0x';
  for (let i = 0; i < hexAddr.length; i++) {
    out += parseInt(hashHex[i], 16) >= 8 ? hexAddr[i].toUpperCase() : hexAddr[i];
  }
  return out;
}

/** Tron: base58check of (0x41 || keccak address). */
function tronAddress(seed: Uint8Array, path: string): string {
  return base58check(new Uint8Array([0x41, ...ethHash20(seed, path)]));
}

// SLIP-0010 ed25519 (hardened-only) derivation — for Solana.
function ser32(i: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, i, false);
  return b;
}
function ed25519Node(seed: Uint8Array, path: number[]): Uint8Array {
  let I = hmac(sha512, utf8ToBytes('ed25519 seed'), seed);
  let key = I.slice(0, 32);
  let chain = I.slice(32);
  for (const index of path) {
    const data = new Uint8Array([0, ...key, ...ser32((index | 0x80000000) >>> 0)]);
    I = hmac(sha512, chain, data);
    key = I.slice(0, 32);
    chain = I.slice(32);
  }
  return key;
}
function solanaAddress(seed: Uint8Array): string {
  const priv = ed25519Node(seed, [44, 501, 0, 0]); // m/44'/501'/0'/0'
  return base58.encode(ed25519.getPublicKey(priv));
}

// Stacks c32check (Crockford-style base32 with a double-SHA256 checksum).
const C32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function c32encode(bytes: Uint8Array): string {
  let num = BigInt('0x' + (bytesToHex(bytes) || '0'));
  let enc = num === 0n ? '0' : '';
  while (num > 0n) {
    enc = C32[Number(num % 32n)] + enc;
    num /= 32n;
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) enc = '0' + enc;
  return enc;
}
function stacksAddress(seed: Uint8Array, path: string): string {
  const version = 22; // mainnet single-sig → "SP"
  const data = hash160(secpPubCompressed(seed, path));
  const checksum = sha256(sha256(new Uint8Array([version, ...data]))).slice(0, 4);
  return 'S' + C32[version] + c32encode(new Uint8Array([...data, ...checksum]));
}

const ETH_PATH = "m/44'/60'/0'/0/0";

// ── currency registry ───────────────────────────────────────────────────────

export const CURRENCIES: Currency[] = [
  {
    id: 'btc', name: 'Bitcoin', symbol: 'BTC', color: '#F7931A',
    networkLabel: 'Bitcoin', icon: twNative('bitcoin'),
    path: "m/84'/0'/0'/0/0", addressLabel: 'Receive address',
    derive: (s) => segwit(s, "m/84'/0'/0'/0/0", 'bc'),
  },
  {
    id: 'stx', name: 'Stacks', symbol: 'STX', color: '#5546FF',
    networkLabel: 'Stacks', icon: STACKS_ICON,
    path: "m/44'/5757'/0'/0/0", addressLabel: 'Receive address',
    derive: (s) => stacksAddress(s, "m/44'/5757'/0'/0/0"),
  },
  {
    id: 'eth', name: 'Ethereum', symbol: 'ETH', color: '#627EEA',
    networkLabel: 'Ethereum', icon: twNative('ethereum'),
    path: ETH_PATH, addressLabel: 'Receive address',
    derive: (s) => ethAddress(s, ETH_PATH),
  },
  {
    id: 'sol', name: 'Solana', symbol: 'SOL', color: '#9945FF',
    networkLabel: 'Solana', icon: twNative('solana'),
    path: "m/44'/501'/0'/0'", addressLabel: 'Receive address',
    derive: (s) => solanaAddress(s),
  },
  {
    id: 'ltc', name: 'Litecoin', symbol: 'LTC', color: '#345D9D',
    networkLabel: 'Litecoin', icon: twNative('litecoin'),
    path: "m/84'/2'/0'/0/0", addressLabel: 'Receive address',
    derive: (s) => segwit(s, "m/84'/2'/0'/0/0", 'ltc'),
  },
  {
    id: 'doge', name: 'Dogecoin', symbol: 'DOGE', color: '#C2A633',
    networkLabel: 'Dogecoin', icon: twNative('doge'),
    path: "m/44'/3'/0'/0/0", addressLabel: 'Receive address',
    derive: (s) => p2pkh(s, "m/44'/3'/0'/0/0", 0x1e),
  },
  {
    id: 'bch', name: 'Bitcoin Cash', symbol: 'BCH', color: '#0AC18E',
    networkLabel: 'Bitcoin Cash', icon: twNative('bitcoincash'),
    path: "m/44'/145'/0'/0/0", addressLabel: 'Receive address (legacy)',
    derive: (s) => p2pkh(s, "m/44'/145'/0'/0/0", 0x00),
  },
  {
    id: 'atom', name: 'Cosmos', symbol: 'ATOM', color: '#6F7390',
    networkLabel: 'Cosmos Hub', icon: twNative('cosmos'),
    path: "m/44'/118'/0'/0/0", addressLabel: 'Receive address',
    derive: (s) => cosmos(s, "m/44'/118'/0'/0/0", 'cosmos'),
  },
  {
    id: 'trx', name: 'Tron', symbol: 'TRX', color: '#EF0027',
    networkLabel: 'Tron', icon: twNative('tron'),
    path: "m/44'/195'/0'/0/0", addressLabel: 'Receive address',
    derive: (s) => tronAddress(s, "m/44'/195'/0'/0/0"),
  },
];

/** Turn a BIP39 mnemonic into the seed used for all coin derivations. */
export function seedFromMnemonic(mnemonic: string): Uint8Array {
  return mnemonicToSeedSync(mnemonic);
}
