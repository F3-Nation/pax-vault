import Image from "next/image";
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
            {region.logo && (
              <Image
                src={region.logo}
                alt={`${region.name}'s logo`}
                width={96}
                height={96}
                className="mx-auto mb-4 rounded-full object-cover"
              />
            )}
            <p><strong>Name:</strong> {region.name}</p>
          </div>
        </main>
  );
}