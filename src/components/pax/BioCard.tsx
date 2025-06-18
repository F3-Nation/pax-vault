"use client";

import { Card, CardHeader } from "@heroui/card";
import { Link } from "@heroui/link";
import { PaxDetail } from "@/types/pax";
import { User } from "@heroui/user";

export function BioCard({ paxInfo }: { paxInfo: PaxDetail }) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50">
      <CardHeader className="flex gap-3">
        <User
          avatarProps={{
            src:  paxInfo?.avatar ? paxInfo.avatar : "https://placehold.in/300x200.png",
            alt: paxInfo.f3_name,
            radius: "md",
          }}
          description={
            <Link
              href={`/stats/region/${paxInfo.region_id}`}
              color="primary"
              size="sm"
            >
              {paxInfo.region || paxInfo.region_default || "Unknown Region"}
            </Link>
          }
          name={
            <span className="text-lg">{paxInfo.f3_name}</span>
          }
          />
      </CardHeader>
    </Card>
  );
}
