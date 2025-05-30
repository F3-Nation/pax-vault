import Link from 'next/link';
import { getCachedRegionData } from '@/lib/region';
import { RegionData as RegionDataType } from '@/lib/data/region';

export default async function RegionPage() {
  const rows = await getCachedRegionData();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
      <div className="p-8 rounded-xl bg-white shadow-xl text-center">
        <h1 className="text-4xl font-bold mb-4">🌍 Region Data</h1>
        <ul className="text-left">
          {rows.map((row: RegionDataType) => (
            <li key={row.id}>
              <Link href={`/stats/region/${row.id}`} className="text-blue-600 hover:underline">
                {row.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}