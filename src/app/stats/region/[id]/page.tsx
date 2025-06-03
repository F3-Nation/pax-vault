import { getCachedRegionData } from '@/lib/region';
import { RegionData as RegionDataType } from '@/lib/data/region';
import { IdProps } from '@/types/props';

export default async function RegionDetailPage({ params }: IdProps) {
  let allRegions: RegionDataType[] = [];
  try {
    allRegions = await getCachedRegionData();
  } catch (err) {
    console.error('Error fetching cached region data:', err);
  }

  const { id } = await params;
  const region = allRegions.find((r) => r.id.toString() === id);

  if (!region) {
    return <div className="p-8 text-center text-red-600">Region not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
      <div className="p-8 rounded-xl bg-white shadow-xl text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">{region.name}</h1>
        <p><strong>Email:</strong> {region.email}</p>
        <p><strong>Website:</strong> {region.website}</p>
        <p><strong>Status:</strong> {region.active ? 'Active' : 'Inactive'}</p>
      </div>
    </main>
  );
}