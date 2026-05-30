import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { ExternalLink, Fingerprint, Smartphone, ThumbsUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import AuthDialog from '@/components/auth/AuthDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useThumbsUp } from '@/hooks/useThumbsUp';
import { toast } from '@/hooks/useToast';
import {
  HACKATHON,
  IOS_APP_URL,
  PROJECT_DESCRIPTION,
  PROJECT_NAME,
  PROJECT_TAGLINE,
  REPO_URL,
  SPEC_URL,
} from '@/lib/projectConfig';

const Index = () => {
  useSeoMeta({
    title: `${PROJECT_NAME} — ${PROJECT_TAGLINE}`,
    description: PROJECT_DESCRIPTION,
  });

  const { user } = useCurrentUser();
  const { count, reacted, isPublishing, react } = useThumbsUp();
  const [authOpen, setAuthOpen] = useState(false);

  const onThumbClick = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (reacted) return;
    try {
      await react();
      toast({ title: 'Thanks!', description: 'Your 👍 is on the relays.' });
    } catch (e) {
      toast({
        title: 'Reaction failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const buttonLabel = !user
    ? 'Sign in to upvote'
    : reacted
      ? 'You upvoted — thanks!'
      : isPublishing
        ? 'Sending…'
        : 'Upvote this project';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight">{PROJECT_NAME}</span>
        <LoginArea />
      </header>

      <main className="container mx-auto px-6 pb-24">
        <section className="mx-auto max-w-2xl pt-14 sm:pt-20 text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-4xl">
            🔑
          </div>

          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {HACKATHON} hackathon
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {PROJECT_NAME}
          </h1>
          <p className="mt-3 text-xl text-muted-foreground">{PROJECT_TAGLINE}</p>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            {PROJECT_DESCRIPTION}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {SPEC_URL && (
              <a
                href={SPEC_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Read the Breez spec
                <ExternalLink className="size-3.5" />
              </a>
            )}
            {IOS_APP_URL && (
              <a
                href={IOS_APP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                <Smartphone className="size-3.5" />
                Get the iOS app
              </a>
            )}
            {REPO_URL && (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Source code
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-xl rounded-3xl border bg-background p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <ThumbsUp className="size-7 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Like what you see?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with a passkey, then upvote our hackathon submission. Your reaction
            is a NIP-25 event signed by the Nostr identity derived from your passkey.
          </p>

          <div className="mt-7 flex flex-col items-center gap-3">
            <Button
              onClick={onThumbClick}
              disabled={isPublishing || reacted}
              size="lg"
              className="h-14 gap-3 px-8 text-lg"
            >
              {user ? (
                reacted ? (
                  <ThumbsUp className="size-5 fill-current" />
                ) : (
                  <ThumbsUp className="size-5" />
                )
              ) : (
                <Fingerprint className="size-5" />
              )}
              <span>{buttonLabel}</span>
            </Button>
            <p className="text-sm text-muted-foreground">
              <span className="text-2xl">👍</span>{' '}
              <span className="font-semibold tabular-nums">{count}</span>{' '}
              {count === 1 ? 'upvote' : 'upvotes'} so far
            </p>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-2xl space-y-6 text-sm text-muted-foreground">
          <div>
            <h3 className="text-base font-semibold text-foreground">How it works</h3>
            <p className="mt-2 leading-relaxed">
              When you tap <em>Create account with passkey</em>, your browser asks your
              authenticator to evaluate a Pseudo-Random Function under two salts in a
              single ceremony. The first PRF output keys your salt-registry account
              (path m/44'/1237'/55'/0/0); the second derives your signing identity
              (path m/44'/1237'/0'/0/0). The salt-registry account publishes a
              kind-1 advertisement so the same passkey can be restored anywhere.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Same passkey, same identity</h3>
            <p className="mt-2 leading-relaxed">
              The iOS companion app uses the same derivation — so if you create the
              passkey there, this site recognises you. No seed phrase. No extension.
              No copy-paste of a 64-character secret. Just biometric tap and you're in.
            </p>
          </div>
        </section>
      </main>

      <AuthDialog isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
};

export default Index;
