import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useAppContext } from './useAppContext';
import { APP_RELAYS } from '@/lib/appRelays';
import { REACTION_CONTENT } from '@/lib/projectConfig';
import type { ZapAsset } from '@/lib/zaps/assets';
import { amountUnit, displayAmount } from '@/lib/zaps/assets';
import {
  buildZapReceipt,
  buildZapRequest,
  makeOrderId,
  type Caip358Receipt,
} from '@/lib/zaps/events';

export type ZapPhase = 'idle' | 'reacting' | 'signing' | 'broadcasting' | 'publishing' | 'done' | 'error';

export interface SendZapParams {
  recipientPubkey: string;
  eventId: string;
  asset: ZapAsset;
  /** Recipient's advertised on-chain address. */
  recipientAddress: string;
  /** Amount in base units. */
  amount: bigint;
  comment: string;
  /** Passkey-derived BIP39 seed (used to sign the on-chain transfer). */
  seed: Uint8Array;
  /** Also publish a kind-7 emoji reaction and link the zap to it (boosted upvote). */
  withReaction?: boolean;
  /** Author of the note (for the reaction's p-tag). */
  noteAuthorPubkey?: string;
}

export interface ZapResult {
  txid: string;
  explorerUrl: string;
}

/**
 * Drive a serverless chain-agnostic zap end-to-end:
 *   (optional) kind-7 reaction → sign kind-9734 → PUSH on-chain → publish kind-9735.
 *
 * The zap request is NOT published to relays (NIP-57 keeps it off-relay); it is
 * embedded in the receipt's `description` tag so verifiers can reconstruct it.
 */
export function useSendZap() {
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<ZapPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const relays = (() => {
    const r = config.relayMetadata.relays.filter((x) => x.write).map((x) => x.url);
    return r.length > 0 ? r : APP_RELAYS.relays.filter((x) => x.write).map((x) => x.url);
  })();

  const sendZap = async (params: SendZapParams): Promise<ZapResult> => {
    if (!user) throw new Error('Not logged in');
    setError(null);
    try {
      const { asset } = params;
      const senderAddress = asset.adapter.deriveAddress(params.seed);

      // Sanity: don't broadcast a transfer we can't cover.
      const balance = await asset.adapter.balanceOf(asset, senderAddress);
      if (balance < params.amount) {
        throw new Error(
          `Insufficient ${asset.label}: you hold ${displayAmount(asset, balance)} ${amountUnit(asset)}, need ${displayAmount(asset, params.amount)} ${amountUnit(asset)}.`,
        );
      }

      // 1. Optional emoji reaction (boosted upvote).
      let reactionId: string | undefined;
      if (params.withReaction) {
        setPhase('reacting');
        const reaction = await publishEvent({
          kind: 7,
          content: REACTION_CONTENT,
          tags: [
            ['e', params.eventId],
            ['p', params.noteAuthorPubkey ?? params.recipientPubkey],
            ['k', '1'],
          ],
        });
        reactionId = reaction.id;
      }

      // 2. Sign the kind-9734 zap request (NOT published — embedded in the receipt).
      setPhase('signing');
      const now = Math.floor(Date.now() / 1000);
      const orderId = makeOrderId(params.eventId, now);
      const requestTemplate = buildZapRequest({
        recipientPubkey: params.recipientPubkey,
        eventId: params.eventId,
        relays,
        assetId: asset.assetId,
        transferType: asset.transferType,
        recipientAddress: params.recipientAddress,
        amount: params.amount,
        comment: params.comment,
        orderId,
        now,
        reactionId,
      });
      const signedRequest = await user.signer.signEvent({
        kind: requestTemplate.kind,
        content: requestTemplate.content ?? '',
        tags: requestTemplate.tags ?? [],
        created_at: now,
      });

      // 3. PUSH the on-chain payment with the passkey-derived key.
      setPhase('broadcasting');
      const txid = await asset.adapter.send(params.seed, {
        asset,
        recipient: params.recipientAddress,
        amount: params.amount,
      });

      // 4. Publish the kind-9735 receipt (sender-published, since PUSH is verifiable).
      setPhase('publishing');
      const receipt: Caip358Receipt = {
        version: 1,
        orderId,
        asset: asset.assetId,
        amount: `0x${params.amount.toString(16)}`,
        recipient: params.recipientAddress,
        sender: senderAddress,
        txid,
        status: 'pending',
      };
      await publishEvent(
        buildZapReceipt({
          recipientPubkey: params.recipientPubkey,
          senderPubkey: user.pubkey,
          eventId: params.eventId,
          requestJson: JSON.stringify(signedRequest),
          network: asset.caip2,
          assetId: asset.assetId,
          txid,
          receipt,
        }),
      );

      setPhase('done');
      queryClient.invalidateQueries({ queryKey: ['zaps', params.eventId] });
      return { txid, explorerUrl: asset.adapter.explorerTx(txid) };
    } catch (e) {
      setPhase('error');
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    }
  };

  return { sendZap, phase, error, reset: () => { setPhase('idle'); setError(null); } };
}
