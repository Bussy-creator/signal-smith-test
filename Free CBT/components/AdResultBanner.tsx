"use client";

import { useEffect, useState } from "react";

interface Ad {
  id: string;
  sponsor_name: string;
  flyer_image_url: string;
  target_link: string | null;
}

/**
 * Prominent promotional flyer shown right after a student finishes a test,
 * alongside (not blocking) the scorecard. Dismissible.
 */
export default function AdResultBanner() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/ads/active?placement=result_banner")
      .then((r) => r.json())
      .then((data) => {
        const ads: Ad[] = data.ads ?? [];
        if (ads.length > 0) setAd(ads[Math.floor(Math.random() * ads.length)]);
      })
      .catch(() => {});
  }, []);

  if (!ad || dismissed) return null;

  return (
    <a
      href={ad.target_link ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 mb-4"
    >
      <img src={ad.flyer_image_url} alt={ad.sponsor_name} className="w-full max-h-40 object-cover" />
      <button
        onClick={(e) => {
          e.preventDefault();
          setDismissed(true);
        }}
        className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 text-xs"
      >
        ✕
      </button>
      <span className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/40 px-1.5 rounded">
        Sponsored · {ad.sponsor_name}
      </span>
    </a>
  );
}
