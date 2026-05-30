import { useNostr } from '@nostrify/react';
import {
  NLogin,
  type NLoginType,
  type NostrConnectParams,
  type NostrConnectStatus,
  useNostrLogin,
} from '@nostrify/react/login';
import { useAppContext } from '@/hooks/useAppContext';
import { APP_RELAYS } from '@/lib/appRelays';
import { BREEZ_MAGIC, assertPasskey, createPasskey, utf8 } from '@/lib/passkey';
import { RECEPTION_SALT, deriveNostrAccount, deriveNostrIdentity } from '@/lib/breezKey';
import { ensureSaltAdvertised } from '@/lib/saltRegistry';

// NOTE: This file should not be edited except for adding new login methods.

export type { NostrConnectParams, NostrConnectStatus };
export { generateNostrConnectParams, generateNostrConnectURI } from '@nostrify/react/login';

export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, setLogin, removeLogin } = useNostrLogin();
  const { config } = useAppContext();

  // Add a login and promote it to be the current user. Without the
  // setLogin call the new login is appended to the end of the array,
  // leaving the prior account as logins[0] — which is what
  // useCurrentUser / useLoggedInAccounts treat as the active user.
  // Promoting here makes "Add another account" actually switch.
  const addAndActivate = (login: NLoginType) => {
    addLogin(login);
    setLogin(login.id);
  };

  return {
    // Login with a Nostr secret key
    nsec(nsec: string): void {
      const login = NLogin.fromNsec(nsec);
      addAndActivate(login);
    },
    // Login with a NIP-46 "bunker://" URI
    async bunker(uri: string): Promise<void> {
      const login = await NLogin.fromBunker(uri, nostr);
      addAndActivate(login);
    },
    // Login with a NIP-07 browser extension
    async extension(): Promise<void> {
      const login = await NLogin.fromExtension();
      addAndActivate(login);
    },
    // Login with a passkey via the Breez Passkey Login spec v0.9.1.
    // One WebAuthn ceremony yields two PRF outputs: one keyed by MAGIC_BYTES
    // (→ salt-registry account) and one keyed by RECEPTION_SALT (→ signing
    // identity). The identity is loaded as a vanilla nsec login so the rest
    // of the app keeps working unchanged.
    async passkey(mode: 'create' | 'signin'): Promise<void> {
      const { prfFirst: accountPrf, prfSecond: identityPrf } = mode === 'create'
        ? await createPasskey({
            rpName: 'passnokkel',
            userName: 'nostr',
            first: BREEZ_MAGIC,
            second: utf8(RECEPTION_SALT),
          })
        : await assertPasskey({ first: BREEZ_MAGIC, second: utf8(RECEPTION_SALT) });

      const account = deriveNostrAccount(accountPrf);
      try {
        await ensureSaltAdvertised(nostr, account.sk, RECEPTION_SALT);
      } catch (err) {
        // Salt advertisement is best-effort: a relay outage shouldn't block
        // sign-in, because the identity is still derivable. Log and continue.
        console.warn('Salt registry update failed:', err);
      }

      const identity = deriveNostrIdentity(identityPrf);
      addAndActivate(NLogin.fromNsec(identity.nsec));
    },
    // Login via nostrconnect:// (client-initiated NIP-46)
    // The client displays a QR code and waits for the remote signer to connect.
    //
    // `onStatus` is forwarded from @nostrify/react so the UI can render
    // live progress through the handshake phases — see NostrConnectStatus.
    async nostrconnect(
      params: NostrConnectParams,
      signal?: AbortSignal,
      onStatus?: (status: NostrConnectStatus) => void,
    ): Promise<void> {
      const login = await NLogin.fromNostrConnect(params, nostr, { signal, onStatus });
      addAndActivate(login);
    },
    // Get the relay URLs for NIP-46 nostrconnect communication
    getRelayUrls(): string[] {
      const relays = config.relayMetadata.relays
        .filter((r) => r.write)
        .map((r) => r.url);
      // Fall back to the app default relays if the user has none configured,
      // so the remote signer has multiple connection options during handshake.
      return relays.length > 0
        ? relays
        : APP_RELAYS.relays.filter((r) => r.write).map((r) => r.url);
    },
    // Log out the current user
    async logout(): Promise<void> {
      const login = logins[0];
      if (login) {
        removeLogin(login.id);
      }
    }
  };
}
