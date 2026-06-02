import { useState } from 'react';

import type { ZapAsset } from '@/lib/zaps/assets';

/**
 * A zap asset's coin logo, falling back to a brand-coloured initials chip if the
 * image fails to load (some tokens have no logo on the asset CDN).
 */
export function AssetLogo({ asset, size }: { asset: ZapAsset; size: number }) {
  const [failed, setFailed] = useState(false);
  const px = { width: size, height: size };

  if (failed) {
    return (
      <span
        className="flex items-center justify-center rounded-full font-bold uppercase text-white"
        style={{ ...px, backgroundColor: asset.color, fontSize: size * 0.3 }}
      >
        {asset.symbol.slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      src={asset.icon}
      alt={asset.label}
      loading="lazy"
      style={px}
      className="rounded-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}
