import { getCachedAoData } from '@/lib/ao';
import { AoData as AoDataType } from '@/lib/data/ao';
import { IdProps } from '@/types/props';

export default async function AoDetailPage({ params }: IdProps) {
  let allAos: AoDataType[] = [];
  try {
    allAos = await getCachedAoData();
  } catch (err) {
    console.error('Error fetching cached ao data:', err);
  }

  const { id } = await params;
  const ao = allAos.find((r) => r.id.toString() === id);

  if (!ao) {
    return <div className="p-8 text-center text-red-600">AO not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
      <div className="p-8 rounded-xl bg-white shadow-xl text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">{ao.name}</h1>
        <p><strong>Email:</strong> {ao.email}</p>
        <p><strong>Website:</strong> {ao.website}</p>
        <p><strong>Status:</strong> {ao.active ? 'Active' : 'Inactive'}</p>
      </div>
    </main>
  );
}