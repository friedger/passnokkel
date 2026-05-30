// WebAuthn PRF (Pseudo-Random Function) helpers for the Breez passkey spec.
// Two PRF eval inputs ride a single ceremony so one user-verification gesture
// yields both the salt-registry-account key material and the identity key
// material.

const HEX_RE = /^[0-9a-fA-F]+$/;

function hex2bytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !HEX_RE.test(hex)) throw new Error('Invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Copy bytes into a fresh ArrayBuffer-backed Uint8Array. The DOM `BufferSource`
 * type narrowed in TS 5.7+ to require `Uint8Array<ArrayBuffer>` (not
 * `ArrayBufferLike`), so library-produced Uint8Arrays need a copy before they
 * can cross into WebAuthn calls.
 */
function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  return buf;
}

/** "NYOASTRTSAOYN" — Breez v0.9.1 MAGIC_BYTES used as the salt for nostr_account PRF. */
export const BREEZ_MAGIC: Uint8Array = hex2bytes('4e594f415354525453414f594e');

/** UTF-8 encode a salt string into the bytes used as a PRF eval input. */
export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

interface PrfPair {
  prfFirst: Uint8Array;
  prfSecond: Uint8Array;
}

interface CreateOpts {
  rpName: string;
  userName: string;
  first: Uint8Array;
  second: Uint8Array;
}

interface AssertOpts {
  first: Uint8Array;
  second: Uint8Array;
  credentialIdHint?: Uint8Array[];
}

function readPrf(result: AuthenticationExtensionsClientOutputs | undefined): PrfPair | null {
  const prf = (result as { prf?: { results?: { first?: ArrayBuffer; second?: ArrayBuffer } } } | undefined)?.prf;
  if (!prf?.results?.first || !prf.results.second) return null;
  return {
    prfFirst: new Uint8Array(prf.results.first),
    prfSecond: new Uint8Array(prf.results.second),
  };
}

/** Create a new discoverable resident credential and return both PRF outputs. */
export async function createPasskey(opts: CreateOpts): Promise<PrfPair & { credentialId: Uint8Array }> {
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { name: opts.rpName },
      user: { id: asBufferSource(userId), name: opts.userName, displayName: opts.userName },
      challenge: asBufferSource(challenge),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      extensions: { prf: { eval: { first: asBufferSource(opts.first), second: asBufferSource(opts.second) } } },
    },
  }) as PublicKeyCredential | null;

  if (!cred) throw new Error('Passkey creation cancelled');

  const credentialId = new Uint8Array(cred.rawId);
  const pair = readPrf(cred.getClientExtensionResults());

  // Some authenticators / browsers don't deliver PRF on create; fall back to
  // an immediate silent assertion against the same credential.
  if (pair) return { ...pair, credentialId };
  const followup = await assertPasskey({
    first: opts.first,
    second: opts.second,
    credentialIdHint: [credentialId],
  });
  return { ...followup, credentialId };
}

/** Assert against an existing credential and read PRF outputs. */
export async function assertPasskey(opts: AssertOpts): Promise<PrfPair> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: asBufferSource(challenge),
      userVerification: 'required',
      allowCredentials: (opts.credentialIdHint ?? []).map((id) => ({ id: asBufferSource(id), type: 'public-key' as const })),
      extensions: { prf: { eval: { first: asBufferSource(opts.first), second: asBufferSource(opts.second) } } },
    },
  }) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Passkey assertion cancelled');
  const pair = readPrf(assertion.getClientExtensionResults());
  if (!pair) throw new Error('Authenticator did not return PRF output — passkey is not PRF-capable');
  return pair;
}

/** True if the browser exposes WebAuthn at all. PRF support is detected per-credential. */
export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';
}
