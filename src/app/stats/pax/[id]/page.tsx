import Link from 'next/link';
import NextImage from "next/image";
import { getCachedPaxData } from '@/lib/pax';
import { PaxData as PaxDataType } from '@/lib/data/pax';
import { IdProps } from '@/types/props';
import { Card, CardHeader, CardBody } from '@heroui/card';
import { Image } from '@heroui/image';
import { Divider } from '@heroui/divider';

export default async function PaxDetailPage({ params }: IdProps) {
  let allPax: PaxDataType[] = [];
  try {
    allPax = await getCachedPaxData();
  } catch (err) {
    console.error('Error fetching cached pax data:', err);
  }

  const { id } = await params;
  const pax = allPax.find((r) => r.id.toString() === id);
  console.log('Pax data:', pax?.avatar);

  if (!pax) {
    return <div className="p-8 text-center text-red-600">Pax not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center font-bold">PAX DETAILS</CardHeader>
        <Divider />
        <CardBody className="p-6">
          <Image
            isZoomed
            as={NextImage}
            src={
              pax?.avatar
                ? pax.avatar
                : 'https://placehold.in/300x200.png'
            }
            alt={`${pax.f3_name}'s avatar`}
            height={200}
            width={300}
          />
          <Divider className='my-4' />
          <div className="flex justify-between mb-2">
            <span className="font-semibold">First Name:</span>
            <span>{pax.first_name}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Last Name:</span>
            <span>{pax.last_name}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Region:</span>
            <span>
              {pax.region_id ? (
                <Link href={`/stats/region/${pax.region_id}`} className="text-blue-600 underline">
                  {pax.region || pax.region_default || "Unknown Region"}
                </Link>
              ) : (
                pax.region || pax.region_default || "Unknown Region"
              )}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Status:</span>
            <span>{pax.status ? 'Active' : 'Inactive'}</span>
          </div>
        </CardBody>
      </Card>
    </div>
    </main>
  );
}