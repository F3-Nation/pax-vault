import Link from 'next/link';
import NextImage from "next/image";
import { getCachedRegionData } from '@/lib/region';
import { RegionData as RegionDataType } from '@/lib/data/region';
import { IdProps } from '@/types/props';
import { Card, CardHeader, CardBody } from '@heroui/card';
import { Image } from '@heroui/image';
import { Divider } from '@heroui/divider';

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
    <main className="flex min-h-screen flex-col items-center justify-center">
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center font-bold">REGION DETAILS</CardHeader>
        <Divider />
        <CardBody className="p-6">
          <Image
            isZoomed
            as={NextImage}
            src={
              region?.logo
                ? region.logo
                : 'https://placehold.in/300x200.png'
            }
            alt={`${region.name}'s logo`}
            height={200}
            width={300}
          />
          <Divider className='my-4' />
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Name:</span>
            <span>{region.name}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Email:</span>
            <span>
              {region.email ? (
                <Link href={`mailto:${region.email}`} className="text-blue-600 underline">
                  {"Email Region"}
                </Link>
              ) : (
                region.email || 'No email available'
              )}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Website:</span>
            <span>
              {region.website ? (
                <Link href={`${region.website}`} className="text-blue-600 underline">
                  {"Visit Website"}
                </Link>
              ) : (
                region.website || 'No website available'
              )}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Status:</span>
            <span>{region.active ? 'Active' : 'Inactive'}</span>
          </div>
        </CardBody>
      </Card>
    </div>
    </main>
  );
}