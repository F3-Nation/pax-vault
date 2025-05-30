import Link from 'next/link';
import { getCachedPaxData } from '@/lib/pax';
import { PaxData as PaxDataType } from '@/lib/data/pax';

export default async function RegionPage() {
  const rows = await getCachedPaxData();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
      <div className="p-8 rounded-xl bg-white shadow-xl text-center">
        <h1 className="text-4xl font-bold mb-4">🌍 PAX Data</h1>
        <ul className="text-left">
          {rows.map((row: PaxDataType) => (
            <li key={row.id}>
              <Link href={`/stats/pax/${row.id}`} className="text-blue-600 hover:underline">
                {row.f3_name} {row.first_name} {row.last_name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}