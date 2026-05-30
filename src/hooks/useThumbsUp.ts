import { useCallback, useEffect, useState } from 'react';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import {
  PROJECT_AUTHOR_PUBKEY,
  PROJECT_EVENT_ID,
  REACTION_CONTENT,
} from '@/lib/projectConfig';

interface UseThumbsUp {
  count: number;
  reacted: boolean;
  isPublishing: boolean;
  react: () => Promise<void>;
}

/**
 * Live thumbs-up count for the hackathon announcement note.
 *
 * Opens one long-lived REQ subscription per mount, streaming all kind-7
 * reactions referencing PROJECT_EVENT_ID. New reactions push into a Set
 * keyed by pubkey (NIP-25 doesn't define dedup; one upvote per identity is
 * the only honest UX), and `count = set.size`.
 *
 * `react()` publishes a kind-7 via the existing useNostrPublish mutation and
 * optimistically adds the current user's pubkey so the UI updates without
 * waiting for the relay echo.
 */
export function useThumbsUp(): UseThumbsUp {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish, isPending: isPublishing } = useNostrPublish();
  const [reactorPubkeys, setReactorPubkeys] = useState<Set<string>>(() => new Set());

  // If PROJECT_EVENT_ID is still the placeholder, don't subscribe — there's
  // nothing meaningful to count and we'd burn relay subscriptions for noise.
  const eventIdLooksReal = /^[0-9a-f]{64}$/i.test(PROJECT_EVENT_ID);

  useEffect(() => {
    if (!eventIdLooksReal) return;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        for await (const msg of nostr.req(
          [{ kinds: [7], '#e': [PROJECT_EVENT_ID] }],
          { signal: controller.signal },
        )) {
          if (cancelled) break;
          if (msg[0] !== 'EVENT') continue;
          const ev = msg[2] as NostrEvent;
          // Treat any non-negative reaction as a thumbs-up. The spec says
          // "+" / "" are likes; we additionally accept the literal emoji
          // we publish. Explicit "-" is a downvote — exclude it.
          if (ev.content === '-') continue;
          setReactorPubkeys((prev) => {
            if (prev.has(ev.pubkey)) return prev;
            const next = new Set(prev);
            next.add(ev.pubkey);
            return next;
          });
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('Reaction subscription error:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nostr, eventIdLooksReal]);

  const reacted = !!user && reactorPubkeys.has(user.pubkey);

  const react = useCallback(async () => {
    if (!user) throw new Error('Not logged in');
    if (reacted) return;
    // Optimistic update — relay echoes will confirm.
    setReactorPubkeys((prev) => {
      if (prev.has(user.pubkey)) return prev;
      const next = new Set(prev);
      next.add(user.pubkey);
      return next;
    });
    try {
      await publish({
        kind: 7,
        content: REACTION_CONTENT,
        tags: [
          ['e', PROJECT_EVENT_ID],
          ['p', PROJECT_AUTHOR_PUBKEY],
          ['k', '1'],
        ],
      });
    } catch (err) {
      // Roll back optimistic update.
      setReactorPubkeys((prev) => {
        if (!prev.has(user.pubkey)) return prev;
        const next = new Set(prev);
        next.delete(user.pubkey);
        return next;
      });
      throw err;
    }
  }, [publish, reacted, user]);

  return { count: reactorPubkeys.size, reacted, isPublishing, react };
}
