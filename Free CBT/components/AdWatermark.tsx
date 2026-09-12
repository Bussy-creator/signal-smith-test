"use client";

import { useEffect, useState } from "react";

interface Ad {
  id: string;
  sponsor_name: string;
  flyer_image_url: string;
  target_link: string | null;
}

/**
 * Non-intrusive full-background watermark flyer shown behind the quiz UI.
 * Fetches from the cached /api/ads/active endpoint — cheap even at 8,000
 * concurrent sessions since the route itself is Redis-cached.
 */
export default function AdWatermark() {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    fetch("/api/ads/active?placement=watermark")
      .then((r) => r.json())
      .then((data) => {
        const ads: Ad[] = data.ads ?? [];
        if (ads.length > 0) setAd(ads[Math.floor(Math.random() * ads.length)]);
      })
      .catch(() => {});
  }, []);

  if (!ad) return null;

  return (
    <div
      className="ad-watermark-layer"
      style={{ backgroundImage: `url(${ad.flyer_image_url})` }}
      aria-hidden="true"
      title={`Sponsored by ${ad.sponsor_name}`}
    />
  );
}
