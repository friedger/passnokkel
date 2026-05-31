// WebAuthn can't tell you "does a passkey exist for this site?" without a user
// gesture and a ceremony — by design, for privacy. So we remember, locally,
// whether this browser has ever created or used a passkey for passnokkel, and
// use that to pick the right primary call-to-action (Create vs Login). The
// flag can be wrong for a synced passkey on a brand-new browser, so the UI
// always keeps the other path one tap away.

const KEY = 'passnokkel:has-passkey';

export function hasPasskeyAccount(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markPasskeyAccount(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Private mode / storage disabled — non-fatal, we just fall back to the
    // "Create account" default next time.
  }
}
