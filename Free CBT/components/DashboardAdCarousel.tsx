"use client";

import { useEffect, useState } from "react";

interface Ad {
  id: string;
  sponsor_name: string;
  flyer_image_url: string;
  target_link: string | null;
}

const ROTATE_MS = 5000;

/**
 * Auto-advancing carousel for dashboard-placement ads — cycles through
 * every active ad, one at a time, looping back to the start. Dots below
 * let the student jump to a specific ad or see how many there are.
 */
export default function DashboardAdCarousel() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/ads/active?placement=dashboard")
      .then((r) => r.json())
      .then((data) => setAds(data.ads ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (ads.length === 0) return null;

  const ad = ads[index];

  return (
    <div className="mb-8 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
      <a
        href={ad.target_link ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative"
      >
        <img
          key={ad.id}
          src={ad.flyer_image_url}
          alt={ad.sponsor_name}
          className="w-full max-h-48 object-cover animate-fadein"
        />
        <span className="absolute bottom-2 left-3 text-[10px] text-white/90 bg-black/40 px-1.5 rounded">
          Sponsored · {ad.sponsor_name}
        </span>
      </a>
      {ads.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2 bg-gray-50 dark:bg-gray-900">
          {ads.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setIndex(i)}
              aria-label={`Show ad ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-brand" : "w-1.5 bg-gray-300 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
