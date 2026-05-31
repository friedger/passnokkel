import { useEffect, useRef, useState } from 'react';

import { QRCodeCanvas } from '@/components/ui/qrcode';
import { cn } from '@/lib/utils';

interface ResponsiveQRProps {
  value: string;
  /** Upper bound on the rendered QR size (px). */
  maxSize?: number;
  /** Lower bound so the code stays scannable on tiny screens (px). */
  minSize?: number;
  /** Pixels subtracted from the measured container width (white-card padding). */
  padding?: number;
  /**
   * Optional height constraint. When provided, the QR is also capped at
   * `window.innerHeight - reserveHeight()`, so a full-screen layout (e.g. a
   * slide deck) can subtract its real chrome and keep the code on-screen even
   * with a large system font. Pass a stable callback (useCallback).
   */
  reserveHeight?: () => number;
  level?: 'L' | 'M' | 'Q' | 'H';
  /** Class for the outer wrapper (it is `w-full` and centers the card). */
  className?: string;
}

/**
 * A QR code that sizes itself to the space it's given. It measures its own
 * container (width) — and, when asked, the available viewport height — instead
 * of guessing with fixed offsets, so it scales from a phone card up to a
 * projector without overflowing. Shared by the presentation deck and the
 * wallet page.
 */
export function ResponsiveQR({
  value,
  maxSize = 320,
  minSize = 120,
  padding = 24,
  reserveHeight,
  level = 'M',
  className,
}: ResponsiveQRProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(minSize);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const compute = () => {
      let target = Math.min(maxSize, el.clientWidth - padding);
      if (reserveHeight) {
        target = Math.min(target, window.innerHeight - reserveHeight());
      }
      setSize(Math.max(minSize, Math.floor(target)));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [maxSize, minSize, padding, reserveHeight]);

  return (
    <div ref={wrapRef} className={cn('flex w-full justify-center', className)}>
      <div className="rounded-2xl bg-white p-3 shadow-2xl shadow-primary/20 sm:rounded-3xl sm:p-5">
        <QRCodeCanvas value={value} size={size} level={level} />
      </div>
    </div>
  );
}
