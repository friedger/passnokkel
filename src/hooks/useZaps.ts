import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

import {
  KIND_ZAP_ACCEPT,
  KIND_ZAP_RECEIPT,
  parseAcceptEvent,
  parseZapReceipt,
  type Advertisement,
} from '@/lib/zaps/events';
import { verifyZapReceipt, type ZapVerification } from '@/lib/zaps/verify';

export interface VerifiedZap {
  event: NostrEvent;
  verification: ZapVerification;
}

/**
 * Fetch every CAIP-358 zap receipt (kind:9735) on a note and verify each one
 * against the recipient's signed advertisement and the chain. Verification runs
 * client-side; there is no zap server anywhere in this path.
 */
export function useZaps(eventId: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<VerifiedZap[]>({
    queryKey: ['zaps', eventId],
    enabled: !!eventId && /^[0-9a-f]{64}$/i.test(eventId ?? ''),
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
      const receipts = (
        await nostr.query([{ kinds: [KIND_ZAP_RECEIPT], '#e': [eventId!], limit: 100 }], { signal })
      ).filter((e) => e.tags.some((t) => t[0] === 'payment_type' && t[1] === 'caip358'));

      // Fetch each unique recipient's advertisement (the trust anchor).
      const recipients = [
        ...new Set(receipts.map((r) => parseZapReceipt(r).recipientPubkey).filter((p): p is string => !!p)),
      ];
      const ads = new Map<string, Advertisement | null>();
      if (recipients.length > 0) {
        const adEvents = await nostr.query(
          [{ kinds: [KIND_ZAP_ACCEPT], authors: recipients, limit: recipients.length * 2 }],
          { signal },
        );
        for (const pubkey of recipients) {
          const latest = adEvents
            .filter((e) => e.pubkey === pubkey)
            .sort((a, b) => b.created_at - a.created_at)[0];
          ads.set(pubkey, latest ? parseAcceptEvent(latest) : null);
        }
      }

      const verified = await Promise.all(
        receipts.map(async (event) => {
          const recipient = parseZapReceipt(event).recipientPubkey;
          const advertisement = recipient ? ads.get(recipient) ?? null : null;
          const verification = await verifyZapReceipt(event, advertisement);
          return { event, verification };
        }),
      );

      // Newest first.
      return verified.sort((a, b) => b.event.created_at - a.event.created_at);
    },
  });
}
