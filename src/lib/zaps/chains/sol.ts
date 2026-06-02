// Solana adapter — native SOL transfers via a hand-rolled System Program
// transaction (no @solana/web3.js), in keeping with wallet.ts's @noble-only
// style. A third CAIP namespace (solana) flowing through the exact same
// advertise → discover → request → send → verify pipeline as Stacks and EVM.

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { base58, base64 } from '@scure/base';

import type { ChainAdapter, TransferRequest, VerifyParams, VerifyResult } from './types';

const SOL_PATH = [44, 501, 0, 0]; // m/44'/501'/0'/0'
// System Program id is 32 zero bytes (base58 "111…1").
const SYSTEM_PROGRAM = new Uint8Array(32);
// SPL Token program and Associated Token Account program ids.
const TOKEN_PROGRAM = base58.decode('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM = base58.decode('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const PDA_TAG = utf8ToBytes('ProgramDerivedAddress');

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

// ── SPL token (associated token accounts) ────────────────────────────────────

/** True if the 32 bytes decode to a valid ed25519 curve point (i.e. NOT a PDA). */
function isOnCurve(bytes: Uint8Array): boolean {
  try {
    ed25519.Point.fromBytes(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * The associated token account for (owner, mint): the standard PDA found by
 * scanning bump 255→0 for the first off-curve sha256(seeds ‖ bump ‖ programId ‖
 * "ProgramDerivedAddress"), with seeds = [owner, TOKEN_PROGRAM, mint].
 */
function associatedTokenAddress(owner: Uint8Array, mint: Uint8Array): Uint8Array {
  for (let bump = 255; bump >= 0; bump--) {
    const hash = sha256(
      concat(owner, TOKEN_PROGRAM, mint, new Uint8Array([bump]), ASSOCIATED_TOKEN_PROGRAM, PDA_TAG),
    );
    if (!isOnCurve(hash)) return hash;
  }
  throw new Error('No off-curve ATA address found');
}

/** Encode one instruction: programIdIndex ‖ accounts ‖ data. */
function instruction(programIdIndex: number, accountIndices: number[], data: Uint8Array): Uint8Array {
  return concat(
    new Uint8Array([programIdIndex]),
    shortVec(accountIndices.length),
    new Uint8Array(accountIndices),
    shortVec(data.length),
    data,
  );
}

/**
 * Build a legacy message that (1) idempotently creates the recipient's ATA
 * (sender funds the rent) and (2) does an SPL transfer-checked. Account order:
 * [sender(signer,w), senderAta(w), recipientAta(w), recipientOwner, mint,
 *  systemProgram, tokenProgram, associatedTokenProgram].
 */
function buildSplMessage(
  from: Uint8Array,
  senderAta: Uint8Array,
  recipientAta: Uint8Array,
  recipientOwner: Uint8Array,
  mint: Uint8Array,
  amount: bigint,
  decimals: number,
  blockhash: Uint8Array,
): Uint8Array {
  // 1 writable signer; 5 readonly non-signers (owner, mint, system, token, ata programs).
  const header = new Uint8Array([1, 0, 5]);
  const accountKeys = concat(
    shortVec(8),
    from, // 0
    senderAta, // 1
    recipientAta, // 2
    recipientOwner, // 3
    mint, // 4
    SYSTEM_PROGRAM, // 5
    TOKEN_PROGRAM, // 6
    ASSOCIATED_TOKEN_PROGRAM, // 7
  );
  // ATA program "CreateIdempotent" (discriminator 1):
  // [payer, ata, owner, mint, systemProgram, tokenProgram]
  const createAta = instruction(7, [0, 2, 3, 4, 5, 6], new Uint8Array([1]));
  // Token program "TransferChecked" (index 12): u64 amount, u8 decimals.
  // [source, mint, destination, authority]
  const transfer = instruction(
    6,
    [1, 4, 2, 0],
    concat(new Uint8Array([12]), u64le(amount), new Uint8Array([decimals])),
  );
  const instructions = concat(shortVec(2), createAta, transfer);
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
    if (token.kind === 'sol') {
      const result = await rpc<{ value: number }>(token.rpcUrl, 'getBalance', [address]).catch(() => ({ value: 0 }));
      return BigInt(result.value ?? 0);
    }
    if (token.kind === 'spl') {
      const ata = base58.encode(associatedTokenAddress(base58.decode(address), base58.decode(token.mint)));
      const result = await rpc<{ value: { amount: string } }>(token.rpcUrl, 'getTokenAccountBalance', [ata]).catch(
        () => null,
      );
      return result?.value?.amount ? BigInt(result.value.amount) : 0n;
    }
    throw new Error('Solana adapter requires a SOL or SPL asset');
  },

  async send(seed: Uint8Array, req: TransferRequest): Promise<string> {
    const token = req.asset.token;
    if (token.kind !== 'sol' && token.kind !== 'spl') {
      throw new Error('Solana adapter requires a SOL or SPL asset');
    }

    const priv = solPrivateKey(seed);
    const from = ed25519.getPublicKey(priv);
    const to = base58.decode(req.recipient);
    if (to.length !== 32) throw new Error('Invalid Solana recipient address');

    const { value } = await rpc<{ value: { blockhash: string } }>(token.rpcUrl, 'getLatestBlockhash', [
      { commitment: 'finalized' },
    ]);
    const blockhash = base58.decode(value.blockhash);

    let message: Uint8Array;
    if (token.kind === 'sol') {
      message = buildMessage(from, to, req.amount, blockhash);
    } else {
      const mint = base58.decode(token.mint);
      const senderAta = associatedTokenAddress(from, mint);
      const recipientAta = associatedTokenAddress(to, mint);
      message = buildSplMessage(from, senderAta, recipientAta, to, mint, req.amount, req.asset.decimals, blockhash);
    }

    const signature = ed25519.sign(message, priv);
    const wire = base64.encode(concat(shortVec(1), signature, message));

    // txid is the base58 of the first signature.
    return rpc<string>(token.rpcUrl, 'sendTransaction', [wire, { encoding: 'base64' }]);
  },

  async verify(params: VerifyParams): Promise<VerifyResult> {
    const token = params.asset.token;
    if (token.kind !== 'sol' && token.kind !== 'spl') {
      throw new Error('Solana adapter requires a SOL or SPL asset');
    }

    const tx = await rpc<{
      meta?: {
        err: unknown;
        preBalances: number[];
        postBalances: number[];
        preTokenBalances?: Array<{ accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } }>;
        postTokenBalances?: Array<{ accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } }>;
      } | null;
      transaction?: { message: { accountKeys: string[] } };
    } | null>(token.rpcUrl, 'getTransaction', [
      params.txid,
      { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
    ]).catch(() => null);

    if (!tx || !tx.meta || !tx.transaction) {
      return { found: false, confirmed: false, matches: false, detail: 'Transaction not found on Solana.' };
    }
    const confirmed = tx.meta.err === null;

    if (token.kind === 'spl') {
      // Compare the recipient's token-balance delta for this mint.
      const post = (tx.meta.postTokenBalances ?? []).find(
        (b) => b.owner === params.recipient && b.mint === token.mint,
      );
      if (!post) {
        return {
          found: true,
          confirmed,
          matches: false,
          detail: confirmed ? 'No matching token transfer to the recipient.' : 'Transaction not yet confirmed.',
        };
      }
      const pre = (tx.meta.preTokenBalances ?? []).find((b) => b.accountIndex === post.accountIndex);
      const delta = BigInt(post.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? '0');
      const matches = delta === params.amount;
      return {
        found: true,
        confirmed,
        matches,
        detail: matches
          ? confirmed
            ? 'Verified on Solana.'
            : 'Transfer found but not yet confirmed.'
          : confirmed
            ? 'On-chain token amount does not match the advertised amount.'
            : 'Transaction not yet confirmed.',
      };
    }

    // Native SOL: the recipient pays no fee, so its lamport delta is the transfer.
    const keys = tx.transaction.message.accountKeys;
    const idx = keys.indexOf(params.recipient);
    if (idx < 0) {
      return { found: true, confirmed, matches: false, detail: 'Recipient is not part of this transaction.' };
    }
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
