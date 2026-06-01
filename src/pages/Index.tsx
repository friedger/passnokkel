import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Fingerprint, ThumbsUp, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import AuthDialog from '@/components/auth/AuthDialog';
import { ReactorAvatars } from '@/components/ReactorAvatars';
import { ZapDialog } from '@/components/ZapDialog';
import { ZapList } from '@/components/ZapList';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useThumbsUp } from '@/hooks/useThumbsUp';
import { toast } from '@/hooks/useToast';
import {
  PROJECT_AUTHOR_PUBKEY,
  PROJECT_EVENT_ID,
  PROJECT_NAME,
  PROJECT_NEVENT,
  PROJECT_TAGLINE,
} from '@/lib/projectConfig';

const Index = () => {
  useSeoMeta({
    title: `${PROJECT_NAME} — ${PROJECT_TAGLINE}`,
    description: 'Like passkeys on Nostr? Tap to upvote a hackathon demo of the Breez Passkey Login spec.',
  });

  const { user } = useCurrentUser();
  const { count, reacted, reactors, isPublishing, react } = useThumbsUp();
  const [authOpen, setAuthOpen] = useState(false);
  const [zapOpen, setZapOpen] = useState(false);

  const canZap = !!PROJECT_EVENT_ID && !!PROJECT_AUTHOR_PUBKEY;

  const onZapClick = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setZapOpen(true);
  };

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
        : 'Upvote';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <img src="/icon.png" alt="" className="size-7 rounded-lg" />
          {PROJECT_NAME}
        </Link>
        <LoginArea />
      </header>

      <main className="container mx-auto flex flex-col items-center px-6 pb-24 pt-12 sm:pt-20">
        <img
          src="/icon.png"
          alt={`${PROJECT_NAME} mascot`}
          className="size-36 sm:size-44 rounded-3xl shadow-xl shadow-primary/20"
        />

        <h1 className="mt-10 text-center text-4xl font-bold tracking-tight sm:text-5xl">
          Like Passkeys on Nostr?
        </h1>

        <p className="mt-4 max-w-md text-center text-base text-muted-foreground">
          Tap below to upvote. Signing in creates your Nostr identity from your passkey —
          no seed phrase, no extension.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <Button
            onClick={onThumbClick}
            disabled={isPublishing || reacted}
            size="lg"
            className="h-16 gap-3 rounded-full px-10 text-lg shadow-lg shadow-primary/25"
          >
            {user ? (
              <ThumbsUp className={`size-6 ${reacted ? 'fill-current' : ''}`} />
            ) : (
              <Fingerprint className="size-6" />
            )}
            <span>{buttonLabel}</span>
          </Button>

          {canZap && (
            <Button
              onClick={onZapClick}
              variant="outline"
              size="lg"
              className="h-12 gap-2 rounded-full border-amber-500/40 px-7 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
            >
              <Zap className="size-5" />
              <span>{user ? 'Zap — put money on it' : 'Sign in to zap'}</span>
            </Button>
          )}

          <div className="flex items-baseline gap-2 text-muted-foreground">
            <span className="text-3xl">👍</span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {count}
            </span>
            <span className="text-sm">
              {count === 1 ? 'upvote' : 'upvotes'} so far
            </span>
          </div>

          {reactors.length > 0 && (
            <div className="mt-1">
              <ReactorAvatars pubkeys={reactors} />
            </div>
          )}

          {canZap && (
            <div className="mt-4 w-full max-w-md">
              <ZapList eventId={PROJECT_EVENT_ID} />
            </div>
          )}

          <a
            href={`https://njump.me/${PROJECT_NEVENT}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            see the post on njump
          </a>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link
            to="/how-it-works"
            className="underline underline-offset-4 hover:text-foreground"
          >
            How does this work?
          </Link>
          <Link
            to="/presentation"
            className="underline underline-offset-4 hover:text-foreground"
          >
            View the slides
          </Link>
        </div>
      </main>

      <AuthDialog isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      {canZap && (
        <ZapDialog
          isOpen={zapOpen}
          onClose={() => setZapOpen(false)}
          recipientPubkey={PROJECT_AUTHOR_PUBKEY}
          eventId={PROJECT_EVENT_ID}
          noteAuthorPubkey={PROJECT_AUTHOR_PUBKEY}
        />
      )}
    </div>
  );
};

export default Index;
