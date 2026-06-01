// Stacks adapter — SIP-010 (sBTC) transfers, signed with the passkey-derived
// key and verified against the Hiro API. The signing key and the advertised
// receive address are the SAME key: deriveAddress() runs the private key
// through @stacks/transactions, which (with the compression suffix) reproduces
// the c32 address wallet.ts derives at m/44'/5757'/0'/0/0.

import { HDKey } from '@scure/bip32';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  Cl,
  PostConditionMode,
  Pc,
  broadcastTransaction,
  getAddressFromPrivateKey,
  makeContractCall,
} from '@stacks/transactions';

import type { ChainAdapter, TransferRequest, VerifyParams, VerifyResult } from './types';

const STACKS_PATH = "m/44'/5757'/0'/0/0";
const HIRO_API = 'https://api.hiro.so';
const NETWORK = 'mainnet';

/**
 * 33-byte (compressed) private key hex for the Stacks account. The trailing
 * "01" tells @stacks/transactions to use a compressed pubkey, which is what
 * single-sig "SP…" mainnet addresses are built from — matching wallet.ts.
 */
function stacksPrivateKey(seed: Uint8Array): string {
  const node = HDKey.fromMasterSeed(seed).derive(STACKS_PATH);
  if (!node.privateKey) throw new Error('No Stacks private key for path');
  return bytesToHex(node.privateKey) + '01';
}

function withPrefix(txid: string): string {
  return txid.startsWith('0x') ? txid : `0x${txid}`;
}

export const stacksAdapter: ChainAdapter = {
  namespace: 'stacks',

  deriveAddress(seed: Uint8Array): string {
    return getAddressFromPrivateKey(stacksPrivateKey(seed), NETWORK);
  },

  async balanceOf(asset, address): Promise<bigint> {
    const token = asset.token;
    if (token.kind !== 'sip10') throw new Error('Stacks adapter requires a SIP-010 asset');
    const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 0n;
    const json = (await res.json()) as { fungible_tokens?: Record<string, { balance?: string }> };
    const key = `${token.contractAddress}.${token.contractName}::${token.assetName}`;
    const balance = json.fungible_tokens?.[key]?.balance;
    return balance ? BigInt(balance) : 0n;
  },

  async send(seed: Uint8Array, req: TransferRequest): Promise<string> {
    const token = req.asset.token;
    if (token.kind !== 'sip10') throw new Error('Stacks adapter requires a SIP-010 asset');

    const senderKey = stacksPrivateKey(seed);
    const sender = getAddressFromPrivateKey(senderKey, NETWORK);
    const contractId = `${token.contractAddress}.${token.contractName}` as const;

    const tx = await makeContractCall({
      contractAddress: token.contractAddress,
      contractName: token.contractName,
      functionName: 'transfer',
      // SIP-010: (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
      functionArgs: [
        Cl.uint(req.amount),
        Cl.principal(sender),
        Cl.principal(req.recipient),
        Cl.none(),
      ],
      senderKey,
      network: NETWORK,
      // Deny mode + an exact-amount post-condition: the tx aborts unless it
      // sends exactly `amount` of this token from us. No surprise transfers.
      postConditionMode: PostConditionMode.Deny,
      postConditions: [
        Pc.principal(sender).willSendEq(req.amount).ft(contractId, token.assetName),
      ],
    });

    const result = await broadcastTransaction({ transaction: tx, network: NETWORK });
    if ('error' in result && result.error) {
      throw new Error(`Broadcast rejected: ${result.error}${result.reason ? ` (${result.reason})` : ''}`);
    }
    return withPrefix(result.txid);
  },

  async verify(params: VerifyParams): Promise<VerifyResult> {
    const token = params.asset.token;
    if (token.kind !== 'sip10') throw new Error('Stacks adapter requires a SIP-010 asset');

    const res = await fetch(`${HIRO_API}/extended/v1/tx/${withPrefix(params.txid)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return { found: false, confirmed: false, matches: false, detail: 'Transaction not found on Stacks.' };
    }
    if (!res.ok) {
      return { found: false, confirmed: false, matches: false, detail: `Hiro API error ${res.status}.` };
    }

    const tx = (await res.json()) as {
      tx_status?: string;
      events?: Array<{
        event_type: string;
        asset?: { asset_event_type?: string; asset_id?: string; sender?: string; recipient?: string; amount?: string };
      }>;
    };

    const confirmed = tx.tx_status === 'success';
    const expectedAssetId = `${token.contractAddress}.${token.contractName}::${token.assetName}`;

    const transfer = (tx.events ?? []).find(
      (e) =>
        e.event_type === 'fungible_token_asset' &&
        e.asset?.asset_event_type === 'transfer' &&
        e.asset?.asset_id === expectedAssetId &&
        e.asset?.recipient === params.recipient &&
        (!params.sender || e.asset?.sender === params.sender) &&
        e.asset?.amount === params.amount.toString(),
    );

    if (!transfer) {
      return {
        found: true,
        confirmed,
        matches: false,
        detail: confirmed
          ? 'On-chain transfer does not match the advertised asset, recipient or amount.'
          : `Transaction status: ${tx.tx_status ?? 'unknown'}.`,
      };
    }
    return {
      found: true,
      confirmed,
      matches: true,
      detail: confirmed ? 'Verified on Stacks.' : 'Transfer found but not yet confirmed.',
    };
  },

  explorerTx(txid: string): string {
    return `https://explorer.hiro.so/txid/${withPrefix(txid)}?chain=mainnet`;
  },
};
