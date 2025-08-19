'use client';

import { Card, CardHeader } from "@heroui/card";

export default function MapView({ latLonKey, zoom = 10, address = ""}: { latLonKey: string; zoom?: number; address?: string;}) {
  const [lat, lon] = latLonKey.split(",");

  console.log("MapView latLonKey:", latLonKey);
  console.log("MapView zoom:", zoom);
  console.log("MapView address:", address);
  console.log("MapView lat:", lat);
  console.log("MapView lon:", lon);

  return (
    <Card className="bg-background/60 dark:bg-default-100/50 w-full">
      <CardHeader className="flex justify-between items-center">
        {/* <img src={`https://maps.googleapis.com/maps/api/staticmap?zoom=${zoom}&size=400x400&center=${address}&key=AIzaSyBIjt1XpnOV2hiHXsstYf28rrt4Ks-9JIw`} alt="Map" className="w-full h-64 object-cover" /> */}
        {/* <a
          href={`https://map.f3nation.com/?locationId=${locationId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={`https://maps.googleapis.com/maps/api/staticmap?
        &zoom=${zoom}
        &size=600x300
        &markers=color:red%7C%7C${lat},${lon}
        &key=AIzaSyBIjt1XpnOV2hiHXsstYf28rrt4Ks-9JIw
        &map_id=4c8f6b2da5dc2c8fdcdc2a20`}
            alt="Map"
            className="w-full h-64 object-cover"
          />
        </a> */}
      </CardHeader>
    </Card>
  );
}