import Link from 'next/link';
import NextImage from "next/image";
import { getRegionDetail } from '@/lib/region';
import { RegionDetailResponse } from '@/types/region';
import { IdProps } from '@/types/props';
import { Card, CardHeader, CardBody } from '@heroui/card';
import { Image } from '@heroui/image';
import { Divider } from '@heroui/divider';
import { Chip } from '@heroui/chip';

export default async function RegionDetailPage({ params }: IdProps) {
  const { id } = await params;

  let regionData: RegionDetailResponse | null = null;
  try {
    regionData = await getRegionDetail(Number(id));
  } catch (err) {
    console.error('Error fetching cached region data:', err);
  }

  if (!regionData) {
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
              regionData.region?.logo
                ? regionData.region.logo
                : 'https://placehold.in/300x200.png'
            }
            alt={`${regionData.region?.name}'s logo`}
            height={200}
            width={300}
          />
          <Divider className='my-4' />
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Name:</span>
            <span>{regionData.region?.name}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Email:</span>
            <span>
              {regionData.region?.email ? (
                <Link href={`mailto:${regionData.region?.email}`} className="text-secondary-600">
                  {"Email Region"}
                </Link>
              ) : (
                regionData.region?.email || 'No email available'
              )}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Website:</span>
            <span>
              {regionData.region?.website ? (
                <Link href={`${regionData.region?.website}`} className="text-secondary-600">
                  {"Visit Website"}
                </Link>
              ) : (
                regionData.region?.website || 'No website available'
              )}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Status:</span>
            <span>{regionData.region?.active ? 'Active' : 'Inactive'}</span>
          </div>
          {regionData.region?.aos && regionData.region.aos.length > 0 && (
            <div className="flex mb-2">
              <span className="font-semibold w-1/3">AOs:</span>
              <div className="w-2/3 flex flex-wrap gap-2 justify-end">
                {regionData.region.aos.map((ao) => (
                  <Link key={ao.id} href={`/stats/ao/${ao.id}`}>
                    <Chip
                      className="cursor-pointer"
                      color="secondary"
                      variant="faded"
                    >
                      {ao.name}
                    </Chip>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
    </main>
  );
}