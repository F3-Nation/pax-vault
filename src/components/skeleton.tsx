/**
 * Loading skeleton for the Stat pages.
 *
 * This component mirrors the layout of the stats view while data is loading
 * to reduce layout shift and provide clear visual feedback.
 */

/**
 * Generic animated skeleton block.
 *
 * `height` is passed as a Tailwind utility to allow flexible reuse
 * across different layout sections.
 */
function SkeletonCard({ height = "h-40" }: { height?: string }) {
  return (
    <div
      className={`rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse ${height}`}
    />
  );
}

/**
 * Standard page-width skeleton section wrapper.
 */
function SkeletonSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 w-full max-w-6xl px-4">
      {children}
    </div>
  );
}

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      {/* Bio */}
      <SkeletonSection>
        <SkeletonCard height="h-16" />
      </SkeletonSection>

      {/* Summary + AO stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4">
        <SkeletonCard height="h-40" />
        <SkeletonCard height="h-40" />
      </div>

      {/* Achievements */}
      <SkeletonSection>
        <SkeletonCard height="h-32" />
      </SkeletonSection>

      {/* Backblasts */}
      <SkeletonSection>
        <SkeletonCard height="h-64" />
      </SkeletonSection>
    </main>
  );
}
