/**
 * Loading skeleton for the standalone event page. Mirrors the page layout
 * (breadcrumb, header card, details body) to reduce layout shift.
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
        <SkeletonCard height="h-6" />
        <SkeletonCard height="h-28" />
        <SkeletonCard height="h-64" />
      </div>
    </main>
  );
}
