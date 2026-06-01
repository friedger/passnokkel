// EVM adapter — ERC-20 transfers via a hand-rolled EIP-1559 signer, in keeping
// with wallet.ts's @noble-only style (no ethers/viem dependency). Proves the
// "chain-agnostic" claim: a second CAIP namespace (eip155) flows through the
// exact same advertise → discover → request → send → verify pipeline as Stacks.

import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, concatBytes, hexToBytes } from '@noble/hashes/utils.js';

import type { ChainAdapter, TransferRequest, VerifyParams, VerifyResult } from './types';

const EVM_PATH = "m/44'/60'/0'/0/0";
// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// ERC-20 transfer(address,uint256) selector
const TRANSFER_SELECTOR = 'a9059cbb';

// ── key derivation ────────────────────────────────────────────────────────

function evmPrivateKey(seed: Uint8Array): Uint8Array {
  const node = HDKey.fromMasterSeed(seed).derive(EVM_PATH);
  if (!node.privateKey) throw new Error('No EVM private key for path');
  return node.privateKey;
}

function evmAddress(priv: Uint8Array): string {
  const pub = secp256k1.getPublicKey(priv, false).slice(1); // drop 0x04
  return `0x${bytesToHex(keccak_256(pub).slice(-20))}`;
}

// ── RLP ─────────────────────────────────────────────────────────────────────

type RlpInput = Uint8Array | RlpInput[];

function encodeLength(len: number, offset: number): Uint8Array {
  if (len < 56) return new Uint8Array([offset + len]);
  const hex = len.toString(16);
  const lenBytes = hexToBytes(hex.length % 2 ? `0${hex}` : hex);
  return concatBytes(new Uint8Array([offset + 55 + lenBytes.length]), lenBytes);
}

function rlpEncode(input: RlpInput): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length === 1 && input[0] < 0x80) return input;
    return concatBytes(encodeLength(input.length, 0x80), input);
  }
  const body = concatBytes(...input.map(rlpEncode));
  return concatBytes(encodeLength(body.length, 0xc0), body);
}

/** Minimal big-endian bytes for a non-negative bigint (0n → empty, per RLP). */
function toBytes(value: bigint): Uint8Array {
  if (value === 0n) return new Uint8Array(0);
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  return hexToBytes(hex);
}

// ── JSON-RPC ──────────────────────────────────────────────────────────────

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

const hexToBigInt = (h: string): bigint => (h && h !== '0x' ? BigInt(h) : 0n);

/** 32-byte left-padded hex (no 0x) for ABI encoding. */
function pad32(bytes: Uint8Array): string {
  return bytesToHex(bytes).padStart(64, '0');
}

// ── adapter ───────────────────────────────────────────────────────────────

function buildTransferData(recipient: string, amount: bigint): Uint8Array {
  const to = pad32(hexToBytes(recipient.replace(/^0x/, '').toLowerCase()));
  const value = pad32(toBytes(amount));
  return hexToBytes(TRANSFER_SELECTOR + to + value);
}

export const evmAdapter: ChainAdapter = {
  namespace: 'eip155',

  deriveAddress(seed: Uint8Array): string {
    return evmAddress(evmPrivateKey(seed));
  },

  async balanceOf(asset, address): Promise<bigint> {
    const token = asset.token;
    if (token.kind !== 'erc20') throw new Error('EVM adapter requires an ERC-20 asset');
    // balanceOf(address) selector 0x70a08231
    const data = `0x70a08231${address.replace(/^0x/, '').toLowerCase().padStart(64, '0')}`;
    const result = await rpc<string>(token.rpcUrl, 'eth_call', [
      { to: token.tokenContract, data },
      'latest',
    ]).catch(() => '0x0');
    return hexToBigInt(result);
  },

  async send(seed: Uint8Array, req: TransferRequest): Promise<string> {
    const token = req.asset.token;
    if (token.kind !== 'erc20') throw new Error('EVM adapter requires an ERC-20 asset');

    const priv = evmPrivateKey(seed);
    const from = evmAddress(priv);
    const url = token.rpcUrl;
    const data = buildTransferData(req.recipient, req.amount);
    const toToken = hexToBytes(token.tokenContract.replace(/^0x/, ''));

    const nonce = hexToBigInt(await rpc<string>(url, 'eth_getTransactionCount', [from, 'pending']));
    const block = await rpc<{ baseFeePerGas?: string }>(url, 'eth_getBlockByNumber', ['latest', false]);
    const baseFee = hexToBigInt(block.baseFeePerGas ?? '0x0');
    const priorityFee = hexToBigInt(await rpc<string>(url, 'eth_maxPriorityFeePerGas', []).catch(() => '0x3b9aca00'));
    const maxFee = baseFee * 2n + priorityFee;
    const gasLimit = hexToBigInt(
      await rpc<string>(url, 'eth_estimateGas', [{ from, to: token.tokenContract, data: `0x${bytesToHex(data)}` }]),
    );

    // EIP-1559 (type 0x02): rlp([chainId, nonce, maxPriorityFee, maxFee, gasLimit, to, value, data, accessList])
    const fields: RlpInput[] = [
      toBytes(BigInt(token.chainId)),
      toBytes(nonce),
      toBytes(priorityFee),
      toBytes(maxFee),
      toBytes(gasLimit),
      toToken,
      toBytes(0n),
      data,
      [],
    ];
    const unsigned = concatBytes(new Uint8Array([0x02]), rlpEncode(fields));
    const sigHash = keccak_256(unsigned);
    const sig = secp256k1.sign(sigHash, priv, { prehash: false, format: 'recovered' });
    const yParity = sig[0];
    const r = sig.slice(1, 33);
    const s = sig.slice(33, 65);

    const signed = concatBytes(
      new Uint8Array([0x02]),
      rlpEncode([...fields, toBytes(BigInt(yParity)), r, s]),
    );
    const txid = await rpc<string>(url, 'eth_sendRawTransaction', [`0x${bytesToHex(signed)}`]);
    return txid;
  },

  async verify(params: VerifyParams): Promise<VerifyResult> {
    const token = params.asset.token;
    if (token.kind !== 'erc20') throw new Error('EVM adapter requires an ERC-20 asset');

    const receipt = await rpc<{
      status?: string;
      logs?: Array<{ address: string; topics: string[]; data: string }>;
    } | null>(token.rpcUrl, 'eth_getTransactionReceipt', [params.txid]).catch(() => null);

    if (!receipt) {
      return { found: false, confirmed: false, matches: false, detail: 'Transaction not found on EVM chain.' };
    }
    const confirmed = receipt.status === '0x1';
    const wantTo = params.recipient.replace(/^0x/, '').toLowerCase().padStart(64, '0');
    const wantFrom = params.sender?.replace(/^0x/, '').toLowerCase().padStart(64, '0');

    const transfer = (receipt.logs ?? []).find(
      (log) =>
        log.address.toLowerCase() === token.tokenContract.toLowerCase() &&
        log.topics[0]?.replace(/^0x/, '').toLowerCase() === TRANSFER_TOPIC &&
        log.topics[2]?.replace(/^0x/, '').toLowerCase() === wantTo &&
        (!wantFrom || log.topics[1]?.replace(/^0x/, '').toLowerCase() === wantFrom) &&
        hexToBigInt(log.data) === params.amount,
    );

    if (!transfer) {
      return {
        found: true,
        confirmed,
        matches: false,
        detail: confirmed
          ? 'On-chain transfer does not match the advertised token, recipient or amount.'
          : 'Transaction reverted or is not yet mined.',
      };
    }
    return {
      found: true,
      confirmed,
      matches: true,
      detail: confirmed ? 'Verified on EVM chain.' : 'Transfer found but receipt not confirmed.',
    };
  },

  explorerTx(txid: string): string {
    return `https://etherscan.io/tx/${txid.startsWith('0x') ? txid : `0x${txid}`}`;
  },
};
