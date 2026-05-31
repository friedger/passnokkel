import { useCallback, useState } from 'react';

import { toast } from '@/hooks/useToast';
import { RECEPTION_SALT, mnemonicFromPrf } from '@/lib/breezKey';
import { BREEZ_MAGIC, assertPasskey, passkeysSupported, utf8 } from '@/lib/passkey';

/**
 * Re-derives the BIP39 recovery phrase on demand via a passkey assertion
 * (PRF over RECEPTION_SALT). The phrase lives only in component state for the
 * life of the page — never persisted. Shared by the wallet and export pages so
 * both gate on the same fresh user-verification gesture.
 */
export function usePasskeyMnemonic() {
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const unlock = useCallback(async () => {
    setUnlocking(true);
    try {
      const { prfSecond } = await assertPasskey({
        first: BREEZ_MAGIC,
        second: utf8(RECEPTION_SALT),
      });
      setMnemonic(mnemonicFromPrf(prfSecond));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!/cancel|abort|NotAllowed/i.test(message)) {
        toast({ title: 'Could not unlock', description: message, variant: 'destructive' });
      }
    } finally {
      setUnlocking(false);
    }
  }, []);

  return { mnemonic, unlock, unlocking, supported: passkeysSupported() };
}
