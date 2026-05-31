import { describe, expect, it } from 'vitest';

import { CURRENCIES, seedFromMnemonic } from './wallet';

// The canonical BIP39 test mnemonic. Addresses below are cross-checked against
// reference tools (iancoleman BIP39, official SLIP-0010 / c32check vectors).
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const addr = (id: string) => {
  const seed = seedFromMnemonic(MNEMONIC);
  const coin = CURRENCIES.find((c) => c.id === id);
  if (!coin) throw new Error(`no currency ${id}`);
  return coin.derive(seed);
};

describe('wallet address derivation', () => {
  it('derives the canonical Bitcoin native-segwit address', () => {
    expect(addr('btc')).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  });

  it('derives the canonical Ethereum address (EIP-55)', () => {
    expect(addr('eth')).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  });

  it('derives a Solana base58 address', () => {
    expect(addr('sol')).toBe('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
  });

  it('derives a Stacks (c32check) mainnet address', () => {
    const a = addr('stx');
    expect(a.startsWith('SP')).toBe(true);
    expect(a).toBe('SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J');
  });

  it('produces correctly-prefixed addresses for the long tail', () => {
    expect(addr('ltc').startsWith('ltc1')).toBe(true);
    expect(addr('doge').startsWith('D')).toBe(true);
    expect(addr('atom').startsWith('cosmos1')).toBe(true);
    expect(addr('trx').startsWith('T')).toBe(true);
  });

  it('exposes the expected currency set', () => {
    const ids = CURRENCIES.map((c) => c.id);
    expect(ids).toHaveLength(9);
    for (const id of ['btc', 'stx', 'eth', 'sol']) {
      expect(ids).toContain(id);
    }
    expect(ids).not.toContain('cashu');
    expect(ids).not.toContain('hot');
  });
});
