import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft, Check, Copy, Download, Eye, Fingerprint, Loader2, ShieldAlert } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePasskeyMnemonic } from '@/hooks/usePasskeyMnemonic';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { PROJECT_NAME } from '@/lib/projectConfig';

const Export = () => {
  useSeoMeta({
    title: `${PROJECT_NAME} — export recovery phrase`,
    description: 'Reveal the BIP39 recovery phrase behind your passkey identity.',
  });

  const { user } = useCurrentUser();
  const { mnemonic, unlock, unlocking, supported } = usePasskeyMnemonic();

  // Even after a passkey unlock, keep the words blurred until an explicit tap —
  // guards against shoulder-surfing when the page is left open.
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', description: 'Copy it manually.', variant: 'destructive' });
    }
  }, []);

  const download = useCallback((phrase: string) => {
    const blob = new Blob([phrase + '\n'], { type: 'text/plain; charset=utf-8' });
    const url = globalThis.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${PROJECT_NAME}-recovery-phrase.txt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    globalThis.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, []);

  const words = mnemonic ? mnemonic.split(' ') : [];

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
          <h1 className="text-3xl font-bold tracking-tight">Export recovery phrase</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your passkey derives a standard BIP39 phrase. Export it to use this identity —
            and its wallet keys — in any standard wallet, even without the passkey.
          </p>
        </div>

        {/* Not logged in. */}
        {!user && (
          <div className="mt-10 rounded-2xl border bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Log in with your passkey to export your recovery phrase.
            </p>
            <div className="mt-4 flex justify-center">
              <LoginArea />
            </div>
          </div>
        )}

        {/* Logged in, still locked. */}
        {user && !mnemonic && (
          <div className="mt-8 space-y-4">
            <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                Anyone with these words controls your funds and your Nostr identity. Never
                share them, never type them into a website, and store them offline. We will
                ask for your passkey before showing them.
              </p>
            </div>

            <div className="rounded-2xl border bg-background p-7 text-center">
              {supported ? (
                <>
                  <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
                    <Fingerprint className="size-8 text-primary" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold">Verify it's you</h2>
                  <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
                    Authenticate with your passkey to reveal the phrase. It's re-derived on
                    the spot and never stored.
                  </p>
                  <Button onClick={unlock} disabled={unlocking} className="mt-5 h-12 w-full">
                    {unlocking ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Fingerprint className="mr-2 size-5" />
                    )}
                    Reveal with passkey
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This needs a passkey-capable browser (WebAuthn with PRF).
                </p>
              )}
            </div>
          </div>
        )}

        {/* Unlocked — show the phrase. */}
        {mnemonic && (
          <div className="mt-8 space-y-4">
            <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                These {words.length} words are the master key to everything. Write them down
                and keep them offline. Anyone who sees them can take your funds and your identity.
              </p>
            </div>

            <div className="relative rounded-2xl border bg-background p-4">
              <div
                className={cn(
                  'grid grid-cols-3 gap-2 transition',
                  !revealed && 'pointer-events-none select-none blur-sm',
                )}
              >
                {words.map((word, i) => (
                  <div
                    key={i}
                    className="flex items-baseline gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-2"
                  >
                    <span className="select-none text-[10px] text-muted-foreground">{i + 1}</span>
                    <span className="font-mono text-xs">{word}</span>
                  </div>
                ))}
              </div>

              {!revealed && (
                <button
                  onClick={() => setRevealed(true)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/40 backdrop-blur-[2px]"
                >
                  <span className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow">
                    <Eye className="size-4" />
                    Tap to reveal
                  </span>
                  <span className="text-xs text-muted-foreground">Make sure nobody is looking</span>
                </button>
              )}
            </div>

            {revealed && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => copy(mnemonic)} className="flex-1">
                  {copied ? (
                    <Check className="mr-2 size-4 text-green-600" />
                  ) : (
                    <Copy className="mr-2 size-4" />
                  )}
                  Copy
                </Button>
                <Button variant="outline" onClick={() => download(mnemonic)} className="flex-1">
                  <Download className="mr-2 size-4" />
                  Download
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Export;
