import Link from 'next/link';
import NextImage from "next/image";
import { getPaxDetail } from '@/lib/pax';
import { PaxDetail } from '@/lib/data/pax';
import { IdProps } from '@/types/props';
import { Card, CardHeader, CardBody } from '@heroui/card';
import { Image } from '@heroui/image';
import { Divider } from '@heroui/divider';

export default async function PaxDetailPage({ params }: IdProps) {
  const { id } = await params;
  
  let paxData: PaxDetail | null = null;
  try {
    paxData = await getPaxDetail(Number(id));
  } catch (err) {
    console.error('Error fetching cached region data:', err);
  }
  
  if (!paxData) {
    return <div className="p-8 text-center text-red-600">Pax not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Card 
        className="w-full bg-background/60 dark:bg-default-100/50 max-w-[610px]"
        isBlurred
        shadow="lg"
      >
        <CardHeader className="text-center font-bold">PAX DETAILS</CardHeader>
        <Divider />
        <CardBody className="p-6">
          <Image
            isZoomed
            as={NextImage}
            src={
              paxData?.avatar
                ? paxData.avatar
                : 'https://placehold.in/300x200.png'
            }
            alt={`${paxData.f3_name}'s avatar`}
            height={200}
            width={300}
          />
          <Divider className='my-4' />
          <div className="flex justify-between mb-2">
            <span className="font-semibold">First Name:</span>
            <span>{paxData.first_name}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Last Name:</span>
            <span>{paxData.last_name}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Region:</span>
            <span>
              {paxData.region_id ? (
                <Link href={`/stats/region/${paxData.region_id}`} className="text-secondary-600">
                  {paxData.region || paxData.region_default || "Unknown Region"}
                </Link>
              ) : (
                paxData.region || paxData.region_default || "Unknown Region"
              )}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Status:</span>
            <span>{paxData.status ? 'Active' : 'Inactive'}</span>
          </div>
        </CardBody>
      </Card>
    </div>
    </main>
  );
}