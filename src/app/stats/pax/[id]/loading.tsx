// src/app/stats/pax/[id]/loading.tsx

function SkeletonCard({ height = 'h-40' }: { height?: string }) {
  return (
    <div className={`rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse ${height}`} />
  );
}

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Bio Skeleton */}
        <SkeletonCard height="h-16" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4">
        {/* Workout Summary Skeleton */}
        <SkeletonCard height="h-40" />
        {/* AO Stats Skeleton */}
        <SkeletonCard height="h-40" />
      </div>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        {/* Achievements Skeleton */}
        <SkeletonCard height="h-32" />
      </div>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        {/* Backblasts Skeleton */}
        <SkeletonCard height="h-64" />
      </div>
    </main>
  );
}