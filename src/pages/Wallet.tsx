import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft, Check, Copy, Fingerprint, Loader2 } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { ResponsiveQR } from '@/components/ResponsiveQR';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePasskeyMnemonic } from '@/hooks/usePasskeyMnemonic';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { PROJECT_NAME } from '@/lib/projectConfig';
import { CURRENCIES, type Currency, seedFromMnemonic } from '@/lib/wallet';

/** Currency logo from the asset host, with a branded fallback chip when the
 * host has no icon for that coin (mirrors the host's own onerror behaviour). */
function CoinLogo({ currency, size }: { currency: Currency; size: number }) {
  const [failed, setFailed] = useState(false);
  const px = { width: size, height: size };

  if (failed) {
    return (
      <span
        className="flex items-center justify-center rounded-full font-bold uppercase text-white"
        style={{ ...px, backgroundColor: currency.color, fontSize: size * 0.32 }}
      >
        {currency.symbol.slice(0, 3)}
      </span>
    );
  }
  return (
    <img
      src={currency.icon}
      alt={currency.name}
      loading="lazy"
      style={px}
      className="rounded-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

/** A selectable currency tile. */
function CoinTile({
  currency,
  selected,
  onClick,
}: {
  currency: Currency;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={currency.name}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition focus:outline-none',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-transparent hover:border-border hover:bg-muted/50',
      )}
    >
      <CoinLogo currency={currency} size={40} />
      <span className="text-[11px] font-semibold leading-none">{currency.symbol}</span>
    </button>
  );
}

const Wallet = () => {
  useSeoMeta({
    title: `${PROJECT_NAME} — wallet`,
    description:
      'Derive Bitcoin, Stacks, Ethereum, Solana, Holo and more from the same passkey-backed recovery phrase.',
  });

  const { user } = useCurrentUser();
  const { mnemonic, unlock, unlocking, supported } = usePasskeyMnemonic();

  const [selectedId, setSelectedId] = useState('btc');
  const [copied, setCopied] = useState(false);

  const seed = useMemo(
    () => (mnemonic ? seedFromMnemonic(mnemonic) : null),
    [mnemonic],
  );
  const selected = CURRENCIES.find((c) => c.id === selectedId) ?? CURRENCIES[0];

  // Derive the address for the selected coin. Wrapped in a try so a single
  // bad path never blanks the whole page.
  const address = useMemo(() => {
    if (!seed) return null;
    try {
      return selected.derive(seed);
    } catch (err) {
      console.error('Address derivation failed:', err);
      return null;
    }
  }, [seed, selected]);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', description: 'Copy it manually.', variant: 'destructive' });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <img src="/icon.png" alt="" className="size-7 rounded-lg" />
          {PROJECT_NAME}
        </Link>
        <LoginArea />
      </header>

      <main className="container mx-auto max-w-md px-5 pb-24 pt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <div className="mt-5">
          <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            One passkey, many chains. Every address is derived from the same recovery
            phrase that backs your identity.
          </p>
        </div>

        {/* Not logged in. */}
        {!user && (
          <div className="mt-10 rounded-2xl border bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Log in with your passkey to view your wallet.
            </p>
            <div className="mt-4 flex justify-center">
              <LoginArea />
            </div>
          </div>
        )}

        {/* Logged in, wallet still locked. */}
        {user && !mnemonic && (
          <div className="mt-10 rounded-2xl border bg-background p-7 text-center">
            {supported ? (
              <>
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
                  <Fingerprint className="size-8 text-primary" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">Unlock your wallet</h2>
                <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
                  Authenticate with your passkey to re-derive your keys on the spot.
                  Nothing is stored on this device.
                </p>
                <Button onClick={unlock} disabled={unlocking} className="mt-5 h-12 w-full">
                  {unlocking ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Fingerprint className="mr-2 size-5" />
                  )}
                  Unlock with passkey
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This wallet needs a passkey-capable browser (WebAuthn with PRF).
              </p>
            )}
          </div>
        )}

        {/* Unlocked. */}
        {mnemonic && (
          <div className="mt-7 space-y-5">
            {/* Currency picker. */}
            <div className="grid grid-cols-5 gap-1.5">
              {CURRENCIES.map((c) => (
                <CoinTile
                  key={c.id}
                  currency={c}
                  selected={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                />
              ))}
            </div>

            {/* Selected address card. */}
            <div className="overflow-hidden rounded-2xl border bg-background">
              <div className="flex items-center gap-3 border-b px-5 py-4">
                <CoinLogo currency={selected} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-none">{selected.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.networkLabel}</p>
                </div>
                <span className="ml-auto rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                  {selected.path}
                </span>
              </div>

              {address ? (
                <div className="px-5 py-6">
                  <div className="mx-auto max-w-[260px]">
                    <ResponsiveQR value={address} maxSize={220} minSize={140} level="M" />
                  </div>

                  <p className="mt-6 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    {selected.addressLabel}
                  </p>
                  <button
                    onClick={() => copy(address)}
                    className="group mt-1.5 flex w-full items-start gap-2 rounded-xl border bg-muted/40 p-3 text-left transition hover:bg-muted"
                    title="Copy address"
                  >
                    <code className="flex-1 break-all font-mono text-xs text-foreground">{address}</code>
                    {copied ? (
                      <Check className="size-4 shrink-0 text-green-600" />
                    ) : (
                      <Copy className="size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                    )}
                  </button>

                  {selected.note && (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{selected.note}</p>
                  )}
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-destructive">Could not derive this address.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Wallet;
