/**
 * Loading skeleton for the region preferences page.
 *
 * Mirrors the page layout (header + single settings card) to reduce layout
 * shift while the permission check and preferences read resolve.
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
      <div className="grid grid-cols-1 gap-6 w-full max-w-3xl pb-6 px-4">
        {/* Page header */}
        <SkeletonCard height="h-16" />
        {/* Preferences card */}
        <SkeletonCard height="h-64" />
      </div>
    </main>
  );
}
