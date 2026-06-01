// Solana adapter — native SOL transfers via a hand-rolled System Program
// transaction (no @solana/web3.js), in keeping with wallet.ts's @noble-only
// style. A third CAIP namespace (solana) flowing through the exact same
// advertise → discover → request → send → verify pipeline as Stacks and EVM.

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { base58, base64 } from '@scure/base';

import type { ChainAdapter, TransferRequest, VerifyParams, VerifyResult } from './types';

const SOL_PATH = [44, 501, 0, 0]; // m/44'/501'/0'/0'
// System Program id is 32 zero bytes (base58 "111…1").
const SYSTEM_PROGRAM = new Uint8Array(32);

// ── SLIP-0010 ed25519 key derivation (hardened-only), mirroring wallet.ts ────

function ser32(i: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, i, false);
  return b;
}

function solPrivateKey(seed: Uint8Array): Uint8Array {
  let I = hmac(sha512, utf8ToBytes('ed25519 seed'), seed);
  let key = I.slice(0, 32);
  let chain = I.slice(32);
  for (const index of SOL_PATH) {
    const data = new Uint8Array([0, ...key, ...ser32((index | 0x80000000) >>> 0)]);
    I = hmac(sha512, chain, data);
    key = I.slice(0, 32);
    chain = I.slice(32);
  }
  return key;
}

// ── serialization helpers ────────────────────────────────────────────────────

function concat(...arrs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

/** compact-u16 (shortvec) length prefix used throughout Solana wire formats. */
function shortVec(n: number): Uint8Array {
  const out: number[] = [];
  let v = n;
  for (;;) {
    const b = v & 0x7f;
    v >>>= 7;
    if (v === 0) {
      out.push(b);
      break;
    }
    out.push(b | 0x80);
  }
  return new Uint8Array(out);
}

function u64le(value: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, value, true);
  return b;
}

/**
 * Build a legacy transaction message for a single System-Program transfer.
 * Account order follows the Solana rule: writable signer, writable non-signer,
 * readonly non-signer. So keys = [from (signer), to, systemProgram].
 */
function buildMessage(from: Uint8Array, to: Uint8Array, lamports: bigint, blockhash: Uint8Array): Uint8Array {
  // header: numRequiredSignatures, numReadonlySignedAccounts, numReadonlyUnsignedAccounts
  const header = new Uint8Array([1, 0, 1]);
  const accountKeys = concat(shortVec(3), from, to, SYSTEM_PROGRAM);
  // System Program "transfer" instruction = u32 LE index 2, then u64 LE lamports.
  const instrData = concat(new Uint8Array([2, 0, 0, 0]), u64le(lamports));
  const instruction = concat(
    new Uint8Array([2]), // program id index → systemProgram
    shortVec(2),
    new Uint8Array([0, 1]), // account indices → [from, to]
    shortVec(instrData.length),
    instrData,
  );
  const instructions = concat(shortVec(1), instruction);
  return concat(header, accountKeys, blockhash, instructions);
}

// ── JSON-RPC ─────────────────────────────────────────────────────────────────

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result as T;
}

export const solAdapter: ChainAdapter = {
  namespace: 'solana',

  deriveAddress(seed: Uint8Array): string {
    return base58.encode(ed25519.getPublicKey(solPrivateKey(seed)));
  },

  async balanceOf(asset, address): Promise<bigint> {
    const token = asset.token;
    if (token.kind !== 'sol') throw new Error('Solana adapter requires a SOL asset');
    const result = await rpc<{ value: number }>(token.rpcUrl, 'getBalance', [address]).catch(() => ({ value: 0 }));
    return BigInt(result.value ?? 0);
  },

  async send(seed: Uint8Array, req: TransferRequest): Promise<string> {
    const token = req.asset.token;
    if (token.kind !== 'sol') throw new Error('Solana adapter requires a SOL asset');

    const priv = solPrivateKey(seed);
    const from = ed25519.getPublicKey(priv);
    const to = base58.decode(req.recipient);
    if (to.length !== 32) throw new Error('Invalid Solana recipient address');

    const { value } = await rpc<{ value: { blockhash: string } }>(token.rpcUrl, 'getLatestBlockhash', [
      { commitment: 'finalized' },
    ]);
    const blockhash = base58.decode(value.blockhash);

    const message = buildMessage(from, to, req.amount, blockhash);
    const signature = ed25519.sign(message, priv);
    const wire = base64.encode(concat(shortVec(1), signature, message));

    // txid is the base58 of the first signature.
    return rpc<string>(token.rpcUrl, 'sendTransaction', [wire, { encoding: 'base64' }]);
  },

  async verify(params: VerifyParams): Promise<VerifyResult> {
    const token = params.asset.token;
    if (token.kind !== 'sol') throw new Error('Solana adapter requires a SOL asset');

    const tx = await rpc<{
      meta?: { err: unknown; preBalances: number[]; postBalances: number[] } | null;
      transaction?: { message: { accountKeys: string[] } };
    } | null>(token.rpcUrl, 'getTransaction', [
      params.txid,
      { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
    ]).catch(() => null);

    if (!tx || !tx.meta || !tx.transaction) {
      return { found: false, confirmed: false, matches: false, detail: 'Transaction not found on Solana.' };
    }

    const confirmed = tx.meta.err === null;
    const keys = tx.transaction.message.accountKeys;
    const idx = keys.indexOf(params.recipient);
    if (idx < 0) {
      return { found: true, confirmed, matches: false, detail: 'Recipient is not part of this transaction.' };
    }

    // The recipient pays no fee, so its balance delta is exactly the transfer.
    const delta = BigInt(tx.meta.postBalances[idx] ?? 0) - BigInt(tx.meta.preBalances[idx] ?? 0);
    const matches = delta === params.amount;
    if (!matches) {
      return {
        found: true,
        confirmed,
        matches: false,
        detail: confirmed
          ? 'On-chain transfer amount does not match the advertised amount.'
          : 'Transaction not yet confirmed.',
      };
    }
    return {
      found: true,
      confirmed,
      matches: true,
      detail: confirmed ? 'Verified on Solana.' : 'Transfer found but not yet confirmed.',
    };
  },

  explorerTx(txid: string): string {
    return `https://explorer.solana.com/tx/${txid}`;
  },
};
