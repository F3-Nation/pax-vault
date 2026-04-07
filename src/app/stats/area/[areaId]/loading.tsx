/**
 * Loading skeleton for the Area stats page.
 */
function SkeletonCard({ height = "h-40" }: { height?: string }) {
  return (
    <div
      className={`rounded-lg mb-6 bg-gray-200 dark:bg-gray-800 animate-pulse ${height}`}
    />
  );
}

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
      <SkeletonSection>
        <SkeletonCard height="h-16" />
      </SkeletonSection>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4">
        <SkeletonCard height="h-52" />
        <SkeletonCard height="h-52" />
      </div>
      <SkeletonSection>
        <SkeletonCard height="h-64" />
      </SkeletonSection>
    </main>
  );
}
