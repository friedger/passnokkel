// Per-chain adapter contract. Each supported namespace (stacks, eip155, …)
// implements this so the zap pipeline — derive receive address, push the
// payment, verify a receipt against the chain — stays chain-agnostic.

import type { ZapAsset } from '../assets';

export interface TransferRequest {
  asset: ZapAsset;
  /** Recipient's on-chain address (the CAIP-10 account_address). */
  recipient: string;
  /** Amount in the asset's base units. */
  amount: bigint;
}

export interface VerifyParams {
  asset: ZapAsset;
  txid: string;
  /** Expected sender address (omit to skip the sender check). */
  sender?: string;
  /** Expected recipient address. */
  recipient: string;
  /** Expected amount in base units. */
  amount: bigint;
}

export interface VerifyResult {
  /** Transaction exists on-chain. */
  found: boolean;
  /** Transaction reached finality (confirmed / in an anchored block). */
  confirmed: boolean;
  /** Sender, recipient, asset and amount all match the expectation. */
  matches: boolean;
  /** Human-readable explanation, shown when a zap can't be fully verified. */
  detail: string;
}

export interface ChainAdapter {
  /** CAIP-2 namespace this adapter serves, e.g. "stacks" or "eip155". */
  namespace: string;
  /** Derive the on-chain receive address from the shared BIP39 seed. */
  deriveAddress(seed: Uint8Array): string;
  /** The holder's balance of this asset, in base units (for sender-side intersection). */
  balanceOf(asset: ZapAsset, address: string): Promise<bigint>;
  /** Build, sign (with the passkey-derived key) and broadcast the transfer; resolves to a txid. */
  send(seed: Uint8Array, req: TransferRequest): Promise<string>;
  /** Independently verify a broadcast transfer against the expected params. */
  verify(params: VerifyParams): Promise<VerifyResult>;
  /** Block-explorer URL for a txid (for display). */
  explorerTx(txid: string): string;
}
