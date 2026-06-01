import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { KIND_ZAP_ACCEPT, parseAcceptEvent, type Advertisement } from '@/lib/zaps/events';

/**
 * Fetch a user's latest chain-agnostic zap acceptance advertisement
 * (kind:10021). Filtered by author — a 10021 is a user-owned replaceable
 * event, so the author is the trust boundary. Returns null when the user
 * hasn't enabled chain-agnostic zaps.
 */
export function useZapAcceptance(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<Advertisement | null>({
    queryKey: ['zap-acceptance', pubkey],
    enabled: !!pubkey,
    queryFn: async (c) => {
      const events = await nostr.query(
        [{ kinds: [KIND_ZAP_ACCEPT], authors: [pubkey!], limit: 1 }],
        { signal: AbortSignal.any([c.signal, AbortSignal.timeout(5000)]) },
      );
      const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
      return latest ? parseAcceptEvent(latest) : null;
    },
  });
}
