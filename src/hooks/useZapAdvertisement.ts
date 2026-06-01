import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useAppContext } from './useAppContext';
import { APP_RELAYS } from '@/lib/appRelays';
import { ZAP_ASSETS, findAssetById } from '@/lib/zaps/assets';
import {
  KIND_ZAP_ACCEPT,
  buildAcceptEvent,
  parseAcceptEvent,
  type Advertisement,
} from '@/lib/zaps/events';

/** The user's inbox/write relays, used for the 10021 `relay` tags. */
function useWriteRelays(): string[] {
  const { config } = useAppContext();
  const relays = config.relayMetadata.relays.filter((r) => r.write).map((r) => r.url);
  return relays.length > 0 ? relays : APP_RELAYS.relays.filter((r) => r.write).map((r) => r.url);
}

/**
 * Read and publish the current user's chain-agnostic zap acceptance
 * advertisement (kind:10021). Publishing requires the passkey-derived seed so
 * receive addresses are derived fresh — never persisted.
 */
export function useZapAdvertisement() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const relays = useWriteRelays();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  const query = useQuery<Advertisement | null>({
    queryKey: ['zap-advertisement', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      const events = await nostr.query(
        [{ kinds: [KIND_ZAP_ACCEPT], authors: [user!.pubkey], limit: 1 }],
        { signal: AbortSignal.any([c.signal, AbortSignal.timeout(5000)]) },
      );
      const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
      return latest ? parseAcceptEvent(latest) : null;
    },
  });

  const publish = useMutation({
    mutationFn: async ({ assetIds, seed }: { assetIds: string[]; seed: Uint8Array }) => {
      if (!user) throw new Error('Not logged in');
      if (assetIds.length === 0) throw new Error('Select at least one asset');

      const accepts = assetIds.map((id) => {
        const asset = findAssetById(id);
        if (!asset) throw new Error(`Unknown asset: ${id}`);
        const address = asset.adapter.deriveAddress(seed);
        return {
          asset: asset.assetId,
          account: `${asset.caip2}:${address}`,
          transferType: asset.transferType,
        };
      });

      const template = buildAcceptEvent({ accepts, relays });
      return publishEvent(template);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zap-advertisement', user?.pubkey] });
    },
  });

  /** Which known assets are currently advertised (by asset id). */
  const advertisedAssetIds = (query.data?.accepts ?? [])
    .map((a) => ZAP_ASSETS.find((asset) => asset.assetId === a.asset)?.id)
    .filter((id): id is string => !!id);

  return {
    advertisement: query.data ?? null,
    advertisedAssetIds,
    isLoading: query.isLoading,
    publish: publish.mutateAsync,
    isPublishing: publish.isPending,
  };
}
