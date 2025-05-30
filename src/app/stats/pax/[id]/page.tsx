import Image from "next/image";
import { getCachedPaxData } from '@/lib/pax';
import { PaxData as PaxDataType } from '@/lib/data/pax';
import { IdProps } from '@/types/props';

export default async function PaxDetailPage({ params }: IdProps) {
  let allPax: PaxDataType[] = [];
  try {
    allPax = await getCachedPaxData();
  } catch (err) {
    console.error('Error fetching cached pax data:', err);
  }

  const { id } = await params;
  const pax = allPax.find((r) => r.id.toString() === id);

  if (!pax) {
    return <div className="p-8 text-center text-red-600">Pax not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
      <div className="p-8 rounded-xl bg-white shadow-xl text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">{pax.f3_name}</h1>
        {pax.avatar_url && (
          <Image
            src={pax.avatar_url}
            alt={`${pax.f3_name}'s avatar`}
            width={96}
            height={96}
            className="mx-auto mb-4 rounded-full object-cover"
          />
        )}
        <p><strong>First Name:</strong> {pax.first_name}</p>
        <p><strong>Last Name:</strong> {pax.last_name}</p>
        <p><strong>Status:</strong> {pax.status ? 'Active' : 'Inactive'}</p>
      </div>
    </main>
  );
}