/**
 * Loading skeleton for the 8 Box pages.
 *
 * Mirrors the page layout (header + board card + history card) to reduce
 * layout shift while the owner check and BigQuery read resolve.
 */

function SkeletonCard({ height = "h-40" }: { height?: string }) {
  return (
    <div
      className={`rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse ${height}`}
    />
  );
}

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        <SkeletonCard height="h-16" />
        <SkeletonCard height="h-96" />
        <SkeletonCard height="h-40" />
      </div>
    </main>
  );
}
