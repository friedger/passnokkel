import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft, ArrowRight, ExternalLink, Home } from 'lucide-react';

import { ResponsiveQR } from '@/components/ResponsiveQR';
import { cn } from '@/lib/utils';
import {
  CASHU_ISSUE_URL,
  CHORUS_PR_URL,
  DITTO_PR_URL,
  HACKATHON,
  HORCRUXBACKUP_ISSUE_URL,
  PROJECT_NAME,
  PROJECT_NEVENT,
  SPEC_URL,
  TREASURES_PR_URL,
} from '@/lib/projectConfig';

const SITE_URL = 'https://passnokkel.netlify.app';

/** The title-slide QR. Uses the shared ResponsiveQR but feeds it a height
 * reserve measured from the deck's real chrome (header, footer, title block and
 * the URL line) so the code fills the slide yet never overflows — even on a
 * small phone with a large system font. */
function QrSlide({ value }: { value: string }) {
  const reserveHeight = useCallback(() => {
    const h = (sel: string) =>
      document.querySelector(sel)?.getBoundingClientRect().height ?? 0;
    const url = h('[data-qr-url]');
    // header + footer + title block + URL line + layout gaps & breathing room.
    return h('header') + h('footer') + h('[data-deck-head]') + url + 88;
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4">
      <ResponsiveQR value={value} maxSize={460} minSize={140} padding={28} reserveHeight={reserveHeight} />
      <a
        data-qr-url
        href={value}
        target="_blank"
        rel="noreferrer"
        className="break-all text-center text-base font-medium tracking-tight text-foreground underline underline-offset-4 sm:text-lg"
      >
        {value.replace(/^https?:\/\//, '')}
      </a>
    </div>
  );
}

interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  body: React.ReactNode;
}

/** A picture-frame for slide images. Renders the image when present and
 * falls back to a labeled placeholder when missing — so the deck reads
 * cleanly even before screenshots are dropped in. Two layouts: a wide
 * `landscape` frame (16:10) and a tall `portrait` frame (9:19) sized for
 * a phone screenshot. */
function SlideImage({
  src,
  alt,
  caption,
  orientation = 'landscape',
}: {
  src: string;
  alt: string;
  caption?: string;
  orientation?: 'landscape' | 'portrait';
}) {
  const frame =
    orientation === 'portrait'
      ? 'aspect-[9/19] w-auto max-h-[60vh]'
      : 'aspect-[16/10] w-full max-w-3xl';
  return (
    <figure className="mx-auto flex w-full flex-col items-center gap-3">
      <div className={cn('relative overflow-hidden rounded-2xl border bg-muted/40 shadow-xl shadow-primary/10', frame)}>
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 size-full object-contain"
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = 'none';
            const placeholder = img.nextElementSibling as HTMLElement | null;
            if (placeholder) placeholder.style.display = 'flex';
          }}
        />
        <div
          className="absolute inset-0 hidden flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground"
        >
          <div className="text-5xl opacity-70">🖼️</div>
          <div className="text-sm font-medium">{alt}</div>
          <code className="rounded bg-background/60 px-2 py-1 text-xs">public{src}</code>
        </div>
      </div>
      {caption && <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

function LinkPill({ href, label }: { href: string; label: string }) {
  if (!href) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-dashed bg-background px-4 py-2 text-sm text-muted-foreground">
        {label} — link TBD
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
    >
      {label}
      <ExternalLink className="size-3.5" />
    </a>
  );
}

const SLIDES: Slide[] = [
  {
    id: 'qr',
    title: 'Try it on your phone',
    subtitle: 'Scan to open passnokkel — sign in with a passkey, upvote in one tap.',
    body: <QrSlide value={SITE_URL} />,
  },
  {
    id: 'ios',
    title: 'passnokkel for iOS',
    subtitle: 'Sign a Nostr note from your passkey — on iPhone and Mac.',
    body: (
      <SlideImage
        src="/slides/ios.png"
        alt="passnokkel iOS app — Nostr without key management"
        orientation="portrait"
        caption="Face ID + a synced passkey. No keys to copy."
      />
    ),
  },
  {
    id: 'web',
    title: 'passnokkel on the web',
    subtitle: 'Same passkey → same npub. Tap to upvote.',
    body: (
      <SlideImage
        src="/slides/web.png"
        alt="passnokkel web app showing the Upvote button"
        caption="No seed phrase. No extension. Just a biometric tap."
      />
    ),
  },
  {
    id: 'horcrux',
    title: 'horcruxbackup.com',
    subtitle: 'A passkey can vanish. Here is the problem we filed.',
    body: (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
        <SlideImage src="/slides/horcrux.png" alt="horcruxbackup.com issue thread" />
        <LinkPill href={HORCRUXBACKUP_ISSUE_URL} label="Read the issue" />
      </div>
    ),
  },
  {
    id: 'ditto',
    title: 'Ditto pull request',
    subtitle: 'Bringing passkey login to Soapbox‑Pub Ditto.',
    body: (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
        <SlideImage src="/slides/ditto.png" alt="Ditto merge request diff" />
        <LinkPill href={DITTO_PR_URL} label="Open the Ditto MR" />
      </div>
    ),
  },
  {
    id: 'resources',
    title: 'Resources',
    subtitle: 'Read the spec, see the code, try the app.',
    body: (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <LinkPill href={SPEC_URL} label="Breez Passkey Login spec v0.9.1" />
        <LinkPill href="https://github.com/nostr-protocol/nips/blob/master/06.md" label="NIP-06 — key derivation from seed" />
        <LinkPill href="https://github.com/nostr-protocol/nips/blob/master/25.md" label="NIP-25 — reactions" />
        <LinkPill href={`https://njump.me/${PROJECT_NEVENT}`} label="The note we're upvoting (njump)" />
        <LinkPill href={DITTO_PR_URL} label="Ditto passkey-login PR" />
        <LinkPill href={TREASURES_PR_URL} label="treasures.to passkey-login PR" />
        <LinkPill href={CHORUS_PR_URL} label="chorus-collective passkey-login PR" />
        <LinkPill href={CASHU_ISSUE_URL} label="cashu.me passkey-login PR" />
      </div>
    ),
  },
];

const Presentation = () => {
  useSeoMeta({
    title: `${PROJECT_NAME} — presentation`,
    description: `${HACKATHON} hackathon — slide deck for the passnokkel project.`,
  });

  const [index, setIndex] = useState(0);

  const next = useCallback(() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1)), []);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Home') {
        setIndex(0);
      } else if (e.key === 'End') {
        setIndex(SLIDES.length - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  const slide = SLIDES[index];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-primary/5">
      <header className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <img src="/icon.png" alt="" className="size-7 rounded-lg" />
          {PROJECT_NAME}
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Home className="size-3.5" />
          Exit deck
        </Link>
      </header>

      <main className="container mx-auto flex flex-1 flex-col items-center justify-center px-4 py-4 sm:px-6 sm:py-10">
        <div data-deck-head className="flex w-full flex-col items-center">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:text-xs">
            {HACKATHON} · slide {index + 1} of {SLIDES.length}
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight sm:mt-3 sm:text-5xl">
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p className="mt-2 max-w-2xl text-center text-sm text-muted-foreground sm:mt-3 sm:text-lg">
              {slide.subtitle}
            </p>
          )}
        </div>

        <div className="mt-6 w-full sm:mt-12">{slide.body}</div>
      </main>

      <footer className="container mx-auto flex items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <button
          onClick={prev}
          disabled={index === 0}
          className="inline-flex size-12 items-center justify-center rounded-full border bg-background text-foreground transition hover:bg-muted disabled:opacity-30"
          aria-label="Previous slide"
        >
          <ArrowLeft className="size-5" />
        </button>

        <div className="flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                'size-2.5 rounded-full transition',
                i === index ? 'bg-foreground' : 'bg-muted-foreground/30 hover:bg-muted-foreground/60',
              )}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={index === SLIDES.length - 1}
          className="inline-flex size-12 items-center justify-center rounded-full border bg-background text-foreground transition hover:bg-muted disabled:opacity-30"
          aria-label="Next slide"
        >
          <ArrowRight className="size-5" />
        </button>
      </footer>
    </div>
  );
};

export default Presentation;
