/**
 * Full/inline loading state used for anything that fetches before a quiz
 * can render — topic lists, and starting a practice/exam attempt. Uses
 * the compact square mark (not the wordmark) since it reads clearly at
 * small sizes and centers cleanly.
 *
 * Animation is a breathing logo inside an expanding ring, built entirely
 * from Tailwind's built-in animate-pulse/animate-ping — no custom
 * keyframes needed. Wrapped in motion-safe: so it's inert (just a still
 * logo) for anyone with prefers-reduced-motion set, rather than ignoring
 * that preference.
 */
export default function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <span className="absolute inset-0 rounded-2xl bg-brand/20 motion-safe:animate-ping" />
        <img
          src="/logo-mark.svg"
          alt="Free CBT"
          width={64}
          height={64}
          className="relative w-16 h-16 motion-safe:animate-pulse"
        />
      </div>
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}
