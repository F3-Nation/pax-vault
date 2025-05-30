import Link from 'next/link';
import { getCachedAoData } from '@/lib/ao';
import { AoData as AoDataType } from '@/lib/data/ao';

export default async function RegionPage() {
  const rows = await getCachedAoData();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
      <div className="p-8 rounded-xl bg-white shadow-xl text-center">
        <h1 className="text-4xl font-bold mb-4">🌍 AO Data</h1>
        <ul className="text-left">
          {rows.map((row: AoDataType) => (
            <li key={row.id}>
              <Link href={`/stats/ao/${row.id}`} className="text-blue-600 hover:underline">
                {row.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}