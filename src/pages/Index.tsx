import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Fingerprint, ThumbsUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import AuthDialog from '@/components/auth/AuthDialog';
import { ReactorAvatars } from '@/components/ReactorAvatars';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useThumbsUp } from '@/hooks/useThumbsUp';
import { toast } from '@/hooks/useToast';
import { PROJECT_NAME, PROJECT_NEVENT, PROJECT_TAGLINE } from '@/lib/projectConfig';

const Index = () => {
  useSeoMeta({
    title: `${PROJECT_NAME} — ${PROJECT_TAGLINE}`,
    description: 'Like passkeys on Nostr? Tap to upvote a hackathon demo of the Breez Passkey Login spec.',
  });

  const { user } = useCurrentUser();
  const { count, reacted, reactors, isPublishing, react } = useThumbsUp();
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
    </div>
  );
};

export default Index;
