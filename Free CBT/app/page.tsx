export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <img src="/logo.svg" alt="Free CBT" className="h-12 sm:h-16 mb-6" />
      <h1 className="text-2xl sm:text-3xl font-bold mb-3">Free CBT</h1>
      <p className="text-sm sm:text-base text-gray-500 max-w-md mb-8">
        Practice quizzes and full exam simulations for your university courses — built for
        exam-week traffic, without the lag.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
        <a href="/register" className="px-5 py-2.5 sm:py-2 rounded bg-brand text-white text-center">
          Get started
        </a>
        <a
          href="/login"
          className="px-5 py-2.5 sm:py-2 rounded border border-gray-300 dark:border-gray-700 text-center"
        >
          Log in
        </a>
      </div>
    </div>
  );
}
