// The assets passnokkel can zap with. Each entry binds:
//   • display metadata (label/symbol/icon),
//   • its CAIP-2 chain and CAIP-19 asset id (what gets advertised in kind:10021),
//   • the on-chain token params, and
//   • the ChainAdapter that derives the address, pushes the payment and verifies it.
//
// Scoped to one chain first (sBTC on Stacks, the headline example) then a second
// namespace (USDC on Ethereum) to prove the pipeline is chain-agnostic.

import { stacksAdapter } from './chains/stacks';
import { evmAdapter } from './chains/evm';
import { solAdapter } from './chains/sol';
import type { ChainAdapter } from './chains/types';

export interface StacksToken {
  kind: 'sip10';
  contractAddress: string;
  contractName: string;
  /** The fungible-token asset name defined in the contract. */
  assetName: string;
}

export interface EvmToken {
  kind: 'erc20';
  tokenContract: string;
  chainId: number;
  /** Public JSON-RPC endpoint used for nonce/fee lookups, broadcast and verification. */
  rpcUrl: string;
}

export interface EvmNativeToken {
  kind: 'native-evm';
  chainId: number;
  /** Public JSON-RPC endpoint used for nonce/fee lookups, broadcast and verification. */
  rpcUrl: string;
}

export interface SolToken {
  kind: 'sol';
  /** Public Solana JSON-RPC endpoint used for blockhash, broadcast and verification. */
  rpcUrl: string;
}

export interface SplToken {
  kind: 'spl';
  /** SPL token mint address (base58). */
  mint: string;
  /** Public Solana JSON-RPC endpoint used for blockhash, broadcast and verification. */
  rpcUrl: string;
}

export interface ZapAsset {
  /** Stable internal id. */
  id: string;
  /** Short label shown on the zap option, e.g. "sBTC". */
  label: string;
  symbol: string;
  /** Brand colour for the icon-chip fallback. */
  color: string;
  icon: string;
  /** Network name shown under the label. */
  chainName: string;
  /** CAIP-2 chain id, e.g. "stacks:1". */
  caip2: string;
  /** CAIP-19 asset id advertised in the `accept` tag. */
  assetId: string;
  /** Transfer type from the CAIP-358 draft, e.g. "sip10-transfer". */
  transferType: string;
  /** Token decimals, for amount entry/display. */
  decimals: number;
  /**
   * If set, amounts are entered and displayed as integer base units with this
   * label (e.g. "sats" for sBTC) instead of the decimal symbol.
   */
  baseUnit?: string;
  token: StacksToken | EvmToken | EvmNativeToken | SolToken | SplToken;
  adapter: ChainAdapter;
}

const STACKS_ICON =
  'https://cdn.prod.website-files.com/618b0aafa4afde9048fe3926/6a18fdf1d7e9f8e0985bd6a5_Stacks%20Logo%20png.avif';
const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';

const SBTC_CONTRACT = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4';

export const ZAP_ASSETS: ZapAsset[] = [
  {
    id: 'sbtc',
    label: 'sBTC',
    symbol: 'sBTC',
    color: '#F7931A',
    icon: STACKS_ICON,
    chainName: 'Stacks',
    caip2: 'stacks:1',
    assetId: `stacks:1/${SBTC_CONTRACT}.sbtc-token.sbtc-token`,
    transferType: 'sip10-transfer',
    decimals: 8,
    baseUnit: 'sats',
    token: {
      kind: 'sip10',
      contractAddress: SBTC_CONTRACT,
      contractName: 'sbtc-token',
      assetName: 'sbtc-token',
    },
    adapter: stacksAdapter,
  },
  {
    id: 'usdc-eth',
    label: 'USDC',
    symbol: 'USDC',
    color: '#2775CA',
    icon: `${TW}/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png`,
    chainName: 'Ethereum',
    caip2: 'eip155:1',
    assetId: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    transferType: 'erc20-transfer',
    decimals: 6,
    token: {
      kind: 'erc20',
      tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1,
      rpcUrl: 'https://ethereum-rpc.publicnode.com',
    },
    adapter: evmAdapter,
  },
  {
    id: 'eth',
    label: 'ETH',
    symbol: 'ETH',
    color: '#627EEA',
    icon: `${TW}/ethereum/info/logo.png`,
    chainName: 'Ethereum',
    caip2: 'eip155:1',
    // CAIP-19 native asset: slip44 coin type 60.
    assetId: 'eip155:1/slip44:60',
    transferType: 'eth-transfer',
    decimals: 18,
    token: {
      kind: 'native-evm',
      chainId: 1,
      rpcUrl: 'https://ethereum-rpc.publicnode.com',
    },
    adapter: evmAdapter,
  },
  {
    id: 'sol',
    label: 'SOL',
    symbol: 'SOL',
    color: '#9945FF',
    icon: `${TW}/solana/info/logo.png`,
    chainName: 'Solana',
    caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    // CAIP-19 native asset: slip44 coin type 501.
    assetId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501',
    transferType: 'sol-transfer',
    decimals: 9,
    token: {
      kind: 'sol',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
    },
    adapter: solAdapter,
  },
  {
    id: 'eurc-sol',
    label: 'EURC',
    symbol: 'EURC',
    color: '#2775CA',
    icon: `${TW}/solana/assets/HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr/logo.png`,
    chainName: 'Solana',
    caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    // CAIP-19 SPL token asset: token:<mint>.
    assetId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
    transferType: 'spl-transfer',
    decimals: 6,
    token: {
      kind: 'spl',
      mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
    },
    adapter: solAdapter,
  },
];

export function findAssetById(id: string): ZapAsset | undefined {
  return ZAP_ASSETS.find((a) => a.id === id);
}

/** Match an advertised CAIP-19 asset id back to a known ZapAsset (what we can pay). */
export function findAssetByCaip19(assetId: string): ZapAsset | undefined {
  return ZAP_ASSETS.find((a) => a.assetId === assetId);
}

/** Format a base-unit amount for display, trimming trailing zeros. */
export function formatAmount(asset: ZapAsset, base: bigint): string {
  const divisor = 10n ** BigInt(asset.decimals);
  const whole = base / divisor;
  const frac = base % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(asset.decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/** Parse a human amount string into base units for the asset. */
export function parseAmount(asset: ZapAsset, input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new Error('Enter a valid amount');
  }
  const [whole, frac = ''] = trimmed.split('.');
  if (frac.length > asset.decimals) throw new Error(`Max ${asset.decimals} decimals`);
  const padded = frac.padEnd(asset.decimals, '0');
  return BigInt(whole || '0') * 10n ** BigInt(asset.decimals) + BigInt(padded || '0');
}

/** The unit label shown next to amounts: a base-unit label (e.g. "sats") or the symbol. */
export function amountUnit(asset: ZapAsset): string {
  return asset.baseUnit ?? asset.symbol;
}

/** Format a base-unit amount for display, respecting a base-unit asset (integer + thousands). */
export function displayAmount(asset: ZapAsset, base: bigint): string {
  return asset.baseUnit ? base.toLocaleString('en-US') : formatAmount(asset, base);
}

/** Parse a user-entered amount, respecting a base-unit asset (whole base units only). */
export function parseInputAmount(asset: ZapAsset, input: string): bigint {
  if (!asset.baseUnit) return parseAmount(asset, input);
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) throw new Error(`Enter a whole number of ${asset.baseUnit}`);
  return BigInt(trimmed);
}
