import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Zap } from 'lucide-react';

import { useZaps, type VerifiedZap } from '@/hooks/useZaps';
import { useAuthor } from '@/hooks/useAuthor';
import { generateRandomProfile } from '@/lib/randomProfile';
import { formatAmount } from '@/lib/zaps/assets';
import type { ZapStatus } from '@/lib/zaps/verify';
import { cn } from '@/lib/utils';

const STATUS_META: Record<ZapStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  verified: { label: 'Verified on-chain', className: 'text-green-600', Icon: CheckCircle2 },
  pending: { label: 'Pending confirmation', className: 'text-amber-600', Icon: Clock },
  mismatch: { label: 'Does not match advertisement', className: 'text-destructive', Icon: AlertTriangle },
  unadvertised: { label: 'Address not advertised', className: 'text-destructive', Icon: AlertTriangle },
  unverifiable: { label: 'Could not verify', className: 'text-muted-foreground', Icon: AlertTriangle },
};

function ZapRow({ zap }: { zap: VerifiedZap }) {
  const { verification: v } = zap;
  const author = useAuthor(v.senderPubkey);
  const fallback = v.senderPubkey ? generateRandomProfile(v.senderPubkey) : null;
  const name = author.data?.metadata?.name ?? author.data?.metadata?.display_name ?? fallback?.name ?? 'Someone';
  const meta = STATUS_META[v.status];

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
      <div className="flex size-9 items-center justify-center rounded-full bg-amber-500/10">
        <Zap className="size-4 text-amber-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-semibold">{name}</span>
          {v.asset && v.amount !== undefined && (
            <span className="text-muted-foreground">
              {' '}
              zapped {formatAmount(v.asset, v.amount)} {v.asset.symbol}
            </span>
          )}
        </p>
        <div className={cn('mt-0.5 flex items-center gap-1 text-xs', meta.className)}>
          <meta.Icon className="size-3.5" />
          <span title={v.detail}>{meta.label}</span>
        </div>
      </div>
      {v.explorerUrl && (
        <a
          href={v.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="View on explorer"
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  );
}

/** Renders verified zaps on a note. Unverifiable ones are flagged, not hidden. */
export function ZapList({ eventId }: { eventId: string }) {
  const { data: zaps, isLoading } = useZaps(eventId);

  if (isLoading || !zaps || zaps.length === 0) return null;

  return (
    <div className="w-full max-w-md space-y-2">
      <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {zaps.length} {zaps.length === 1 ? 'zap' : 'zaps'}
      </p>
      {zaps.map((zap) => (
        <ZapRow key={zap.event.id} zap={zap} />
      ))}
    </div>
  );
}
