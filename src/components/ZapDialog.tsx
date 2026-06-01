import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Fingerprint, Loader2, ShieldAlert, Zap } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { usePasskeyMnemonic } from '@/hooks/usePasskeyMnemonic';
import { useZapAcceptance } from '@/hooks/useZapAcceptance';
import { useSendZap, type ZapPhase } from '@/hooks/useSendZap';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { seedFromMnemonic } from '@/lib/wallet';
import { findAssetByCaip19, parseAmount, type ZapAsset } from '@/lib/zaps/assets';
import { accountAddress } from '@/lib/zaps/events';

interface ZapOption {
  asset: ZapAsset;
  address: string;
}

const PHASE_LABEL: Record<ZapPhase, string> = {
  idle: '',
  reacting: 'Publishing your upvote…',
  signing: 'Signing the zap request…',
  broadcasting: 'Broadcasting on-chain…',
  publishing: 'Publishing the receipt…',
  done: 'Done!',
  error: '',
};

export function ZapDialog({
  isOpen,
  onClose,
  recipientPubkey,
  eventId,
  noteAuthorPubkey,
}: {
  isOpen: boolean;
  onClose: () => void;
  recipientPubkey: string;
  eventId: string;
  noteAuthorPubkey?: string;
}) {
  const acceptance = useZapAcceptance(isOpen ? recipientPubkey : undefined);
  const { mnemonic, unlock, unlocking, supported } = usePasskeyMnemonic();
  const { sendZap, phase, error, reset } = useSendZap();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [withReaction, setWithReaction] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<{ txid: string; explorerUrl: string } | null>(null);

  const options: ZapOption[] = useMemo(() => {
    const accepts = acceptance.data?.accepts ?? [];
    return accepts
      .map((a) => {
        const asset = findAssetByCaip19(a.asset);
        const address = accountAddress(a.account);
        return asset && address ? { asset, address } : null;
      })
      .filter((o): o is ZapOption => !!o);
  }, [acceptance.data]);

  const selected = options.find((o) => o.asset.id === selectedId) ?? options[0] ?? null;
  const seed = useMemo(() => (mnemonic ? seedFromMnemonic(mnemonic) : null), [mnemonic]);
  const busy = phase !== 'idle' && phase !== 'error' && phase !== 'done';

  const close = () => {
    if (busy) return;
    reset();
    setResult(null);
    setAcknowledged(false);
    setAmountInput('');
    onClose();
  };

  const onSend = async () => {
    if (!selected || !seed) return;
    let amount: bigint;
    try {
      amount = parseAmount(selected.asset, amountInput);
      if (amount <= 0n) throw new Error('Amount must be greater than zero');
    } catch (e) {
      toast({ title: 'Invalid amount', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
      return;
    }
    try {
      const res = await sendZap({
        recipientPubkey,
        eventId,
        asset: selected.asset,
        recipientAddress: selected.address,
        amount,
        comment: `${selected.asset.label} zap!`,
        seed,
        withReaction,
        noteAuthorPubkey,
      });
      setResult(res);
      toast({ title: 'Zap sent!', description: `${selected.asset.label} is on its way.` });
    } catch (e) {
      toast({ title: 'Zap failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-5 text-amber-500" /> Send a zap
          </DialogTitle>
          <DialogDescription>
            A real on-chain payment to the author's advertised address — no zap server.
          </DialogDescription>
        </DialogHeader>

        {/* Success */}
        {result ? (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="mx-auto size-12 text-green-500" />
            <p className="text-sm font-medium">Your zap is on-chain.</p>
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4"
            >
              View transaction <ExternalLink className="size-3.5" />
            </a>
            <Button onClick={close} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        ) : acceptance.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Looking up accepted assets…
          </div>
        ) : options.length === 0 ? (
          /* Fallback: no chain-agnostic zaps advertised */
          <div className="space-y-3 py-4 text-center">
            {acceptance.data?.lud16 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  This user hasn't advertised on-chain assets, but accepts Lightning:
                </p>
                <code className="block break-all rounded-lg border bg-muted/40 p-2 font-mono text-xs">
                  {acceptance.data.lud16}
                </code>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This user hasn't enabled chain-agnostic zaps yet.
              </p>
            )}
            <Button onClick={close} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Asset options */}
            <div className="space-y-2">
              {options.map(({ asset, address }) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedId(asset.id)}
                  disabled={busy}
                  aria-pressed={selected?.asset.id === asset.id}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    selected?.asset.id === asset.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                  )}
                >
                  <span
                    className="flex size-8 items-center justify-center rounded-full text-[10px] font-bold uppercase text-white"
                    style={{ backgroundColor: asset.color }}
                  >
                    {asset.symbol.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {asset.label} <span className="font-normal text-muted-foreground">on {asset.chainName}</span>
                    </p>
                    <code className="block truncate font-mono text-[11px] text-muted-foreground">{address}</code>
                  </div>
                </button>
              ))}
            </div>

            {/* Amount */}
            {selected && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="zap-amount">
                  Amount ({selected.asset.symbol})
                </label>
                <Input
                  id="zap-amount"
                  inputMode="decimal"
                  placeholder={`0.0001`}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  disabled={busy}
                />
              </div>
            )}

            {/* Boosted upvote toggle */}
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm">
                Also upvote (👍)
                <span className="block text-xs text-muted-foreground">Publish a reaction and link the zap to it</span>
              </span>
              <Switch checked={withReaction} onCheckedChange={setWithReaction} disabled={busy} />
            </label>

            {/* Privacy warning */}
            <Alert variant="destructive" className="border-amber-500/30 bg-amber-500/5">
              <ShieldAlert className="size-4 text-amber-600" />
              <AlertTitle className="text-amber-700">This links your addresses</AlertTitle>
              <AlertDescription className="text-amber-700/90">
                An on-chain zap permanently and publicly links your passkey-derived address to the
                recipient's. There is no taking it back.
              </AlertDescription>
            </Alert>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(v === true)}
                disabled={busy}
                className="mt-0.5"
              />
              I understand this payment is public and irreversible.
            </label>

            {/* Action: unlock then send */}
            {!seed ? (
              <Button onClick={unlock} disabled={!supported || unlocking || !acknowledged} className="h-11 w-full">
                {unlocking ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Fingerprint className="mr-2 size-4" />}
                Unlock wallet with passkey
              </Button>
            ) : (
              <Button onClick={onSend} disabled={busy || !acknowledged || !amountInput} className="h-11 w-full">
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
                {busy ? PHASE_LABEL[phase] : `Zap ${selected?.asset.label ?? ''}`}
              </Button>
            )}

            {error && <p className="text-center text-xs text-destructive">{error}</p>}
            {!supported && (
              <p className="text-center text-xs text-muted-foreground">
                A passkey-capable browser (WebAuthn with PRF) is required to sign the transfer.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
