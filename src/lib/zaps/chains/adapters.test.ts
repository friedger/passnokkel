import { describe, expect, it } from 'vitest';

import { seedFromMnemonic } from '../../wallet';
import { findAssetByCaip19 } from '../assets';
import { evmAdapter } from './evm';
import { solAdapter } from './sol';

// Canonical BIP39 vector — same mnemonic and expected addresses as wallet.test.ts.
// This guards the trust-critical invariant: the address an adapter derives (and
// would send to / verify) MUST equal the address advertised in the kind:10021.
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('native ETH + SOL adapters', () => {
  const seed = seedFromMnemonic(MNEMONIC);

  it('evmAdapter derives the canonical EIP-55 Ethereum address', () => {
    expect(evmAdapter.deriveAddress(seed)).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  });

  it('solAdapter derives the canonical Solana address', () => {
    expect(solAdapter.deriveAddress(seed)).toBe('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
  });

  it('the advertised native CAIP-19 ids resolve to the right adapters', () => {
    const eth = findAssetByCaip19('eip155:1/slip44:60');
    const sol = findAssetByCaip19('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501');
    expect(eth?.adapter.namespace).toBe('eip155');
    expect(eth?.transferType).toBe('eth-transfer');
    expect(eth?.decimals).toBe(18);
    expect(sol?.adapter.namespace).toBe('solana');
    expect(sol?.transferType).toBe('sol-transfer');
    expect(sol?.decimals).toBe(9);
  });
});
