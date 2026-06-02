import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft, ExternalLink, Smartphone } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import {
  HACKATHON,
  IOS_APP_URL,
  PROJECT_NAME,
  REPO_URL,
  SPEC_URL,
} from '@/lib/projectConfig';
import { asset } from '@/lib/asset';

const HowItWorks = () => {
  useSeoMeta({
    title: `${PROJECT_NAME} — how it works`,
    description: 'Breez Passkey Login spec walkthrough: WebAuthn PRF, BIP32 derivation, salt registry on Nostr.',
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <img src={asset('icon.png')} alt="" className="size-7 rounded-lg" />
          {PROJECT_NAME}
        </Link>
        <LoginArea />
      </header>

      <main className="container mx-auto max-w-2xl px-6 pb-24 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">How it works</h1>
        <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">
          {HACKATHON} hackathon · {PROJECT_NAME}
        </p>

        <div className="prose prose-sm mt-10 max-w-none text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Passkey → Nostr identity</h2>
            <p className="leading-relaxed">
              Most Nostr clients ask you to copy a 64-character secret out of one app
              and paste it into another. Passkeys remove that step: the OS holds a
              non-exportable private key, gated by a biometric or PIN, and the
              browser exposes a Pseudo-Random Function (PRF) extension over it.
              We feed two known salts into the PRF and turn the outputs into a
              stable Nostr keypair — deterministic, recoverable, and never written
              to disk.
            </p>
          </section>

          <section className="mt-10 space-y-3">
            <h2 className="text-xl font-semibold text-foreground">The derivation</h2>
            <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-4 text-xs leading-relaxed text-foreground">
{`PRF(passkey, MAGIC_BYTES)   →  account_master   →  m/44'/1237'/55'/0/0   →  nostr_account
PRF(passkey, RECEPTION_SALT) →  root_key         →  m/44'/1237'/0'/0/0    →  nostr_identity`}
            </pre>
            <p className="leading-relaxed">
              <strong className="text-foreground">MAGIC_BYTES</strong> is the constant
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                0x4e594f415354525453414f594e
              </code>
              (the ASCII of <code>NYOASTRTSAOYN</code>). The spec hard-codes it so
              account-master derivation can never collide with any user-chosen salt.
            </p>
            <p className="leading-relaxed">
              <strong className="text-foreground">RECEPTION_SALT</strong> is the
              site-specific salt — we use <code>passnokkel:v1</code>. Different salts
              under the same passkey give you different independent identities; same
              salt always gives back the same one.
            </p>
            <p className="leading-relaxed">
              Both PRF outputs are 32 bytes, exactly the BIP39 entropy budget for a
              24-word mnemonic. We go through the mnemonic step (rather than treating
              PRF bytes as a raw seed) so the derivation is NIP-06 compatible — the
              iOS companion app and this website produce the same npub for the same
              passkey.
            </p>
          </section>

          <section className="mt-10 space-y-3">
            <h2 className="text-xl font-semibold text-foreground">The salt registry</h2>
            <p className="leading-relaxed">
              How does a fresh browser, on a fresh device, know which salts to ask
              the PRF about? The Breez spec answers this with Nostr itself: the
              salt-registry account (<code>nostr_account</code>) publishes one
              kind-1 event per salt it has ever used. On restore, the new client
              authenticates with the passkey, derives the registry account, queries
              relays for its kind-1 events, and re-derives every signing identity.
            </p>
            <p className="leading-relaxed">
              We add a single <code>['t','breez-salt']</code> tag so the registry is
              query-friendly without false positives. The vanilla spec keeps it
              tagless for plausible deniability — both are valid.
            </p>
          </section>

          <section className="mt-10 space-y-3">
            <h2 className="text-xl font-semibold text-foreground">The upvote</h2>
            <p className="leading-relaxed">
              When you tap 👍, this site signs a NIP-25 kind-7 event with the
              derived identity and publishes it to a handful of relays. The 👍 count
              on the home page is a live subscription on the same relays, filtered
              to events that reference our announcement note, deduplicated by
              pubkey. No backend, no caching layer, no aggregator.
            </p>
          </section>

          <section className="mt-10 space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Code</h2>
            <p className="leading-relaxed">
              Everything happens in five files under <code>src/lib</code> and
              <code>src/hooks</code>. The WebAuthn glue is in
              <code>passkey.ts</code>; the derivation is in <code>breezKey.ts</code>;
              the registry is in <code>saltRegistry.ts</code>; the new login method
              is wired into <code>useLoginActions.ts</code>; and the live count is in
              <code>useThumbsUp.ts</code>.
            </p>
          </section>

          <div className="mt-10 flex flex-wrap gap-3">
            {SPEC_URL && (
              <a
                href={SPEC_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Breez spec
                <ExternalLink className="size-3.5" />
              </a>
            )}
            {IOS_APP_URL && (
              <a
                href={IOS_APP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <Smartphone className="size-3.5" />
                iOS app
              </a>
            )}
            {REPO_URL && (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Source
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HowItWorks;
