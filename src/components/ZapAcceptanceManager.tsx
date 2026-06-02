import { useMemo, useState } from 'react';
import { Check, Loader2, ShieldAlert, Zap } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AssetLogo } from '@/components/AssetLogo';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/useToast';
import { useZapAdvertisement } from '@/hooks/useZapAdvertisement';
import { cn } from '@/lib/utils';
import { ZAP_ASSETS } from '@/lib/zaps/assets';

/**
 * Enable chain-agnostic zaps: pick which passkey-derived assets to accept and
 * publish them as a signed kind:10021. The advertised address is the only
 * source of truth a sender will trust, so we derive it fresh from the unlocked
 * seed here.
 */
export function ZapAcceptanceManager({ seed }: { seed: Uint8Array }) {
  const { advertisedAssetIds, isLoading, publish, isPublishing } = useZapAdvertisement();
  const [selected, setSelected] = useState<Set<string> | null>(null);

  // Default the selection to whatever's already advertised (once loaded).
  const effectiveSelected = useMemo(() => {
    if (selected) return selected;
    return new Set(advertisedAssetIds);
  }, [selected, advertisedAssetIds]);

  const toggle = (id: string) => {
    const next = new Set(effectiveSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onPublish = async () => {
    try {
      await publish({ assetIds: Array.from(effectiveSelected), seed });
      toast({ title: 'Zaps enabled', description: 'Your acceptance advertisement is on the relays.' });
      setSelected(null); // fall back to the freshly-fetched advertised set
    } catch (e) {
      toast({
        title: 'Could not publish',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-amber-500/10">
          <Zap className="size-5 text-amber-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none">Chain-agnostic zaps</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Advertise which assets you accept, signed with your passkey identity.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="space-y-2">
          {ZAP_ASSETS.map((asset) => {
            const isSelected = effectiveSelected.has(asset.id);
            const isLive = advertisedAssetIds.includes(asset.id);
            const address = (() => {
              try {
                return asset.adapter.deriveAddress(seed);
              } catch {
                return null;
              }
            })();
            return (
              <button
                key={asset.id}
                onClick={() => toggle(asset.id)}
                aria-pressed={isSelected}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                )}
              >
                <AssetLogo asset={asset} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{asset.label}</span>
                    <span className="text-xs text-muted-foreground">{asset.chainName}</span>
                    {isLive && (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
                        advertised
                      </span>
                    )}
                  </div>
                  {address && (
                    <code className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                      {address}
                    </code>
                  )}
                </div>
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border',
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                  )}
                >
                  {isSelected && <Check className="size-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        <Alert variant="destructive" className="border-amber-500/30 bg-amber-500/5">
          <ShieldAlert className="size-4 text-amber-600" />
          <AlertTitle className="text-amber-700">On-chain zaps are public</AlertTitle>
          <AlertDescription className="text-amber-700/90">
            These are your real, passkey-derived receive addresses. Anyone who zaps you links
            their address to yours permanently on a public ledger.
          </AlertDescription>
        </Alert>

        <Button onClick={onPublish} disabled={isPublishing || isLoading} className="h-11 w-full">
          {isPublishing ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Zap className="mr-2 size-4" />
          )}
          {advertisedAssetIds.length > 0 ? 'Update advertisement' : 'Publish advertisement'}
        </Button>
      </div>
    </div>
  );
}
