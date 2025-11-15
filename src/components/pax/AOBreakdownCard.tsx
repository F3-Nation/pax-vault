"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Link } from "@heroui/link";
import { PaxEventsCalculations } from "@/types/pax";
import { Tab, Tabs } from "@heroui/tabs";
import { useState } from "react";
import { Divider } from "@heroui/divider";

export function AOBreakdownCard({
  paxData,
}: {
  paxData: PaxEventsCalculations | null;
}) {
  const [selected, setSelected] = useState("aoNameCounts");
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="font-semibold text-xl">AO Breakdown</div>
        <Tabs
          aria-label="Select AO Stats View"
          selectedKey={selected}
          onSelectionChange={(key) => setSelected(key as string)}
          size="sm"
          radius="sm"
          variant="bordered"
          color="primary"
          className="text-default-100"
        >
          <Tab key="aoNameCounts" title="As PAX"></Tab>
          <Tab key="aoNameQCounts" title="As Q"></Tab>
        </Tabs>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <ScrollShadow className="h-[320px]">
        <div className="space-y-1 text-sm">
          {Array.isArray(paxData?.[selected as keyof typeof paxData]) &&
          (paxData?.[selected as keyof typeof paxData] as Array<unknown>)
            ?.length > 0 ? (
            (
              paxData?.[selected as keyof typeof paxData] as {
                id: number;
                ao_name: string;
                count: number;
                region_name: string;
                region_org_id: number;
              }[]
            )?.map(
              ({ id, ao_name, count, region_name, region_org_id }, idx) => (
                <div
                  key={ao_name}
                  className={`flex justify-between py-1 pb-2 ${
                    idx !== paxData.aoNameCounts.length - 1
                      ? "border-b light:border-black/10 dark:border-white/10"
                      : ""
                  }`}
                >
                  {id ? (
                    <div className="flex gap-2">
                      <Link
                        className="text-sm"
                        color="primary"
                        href={`/stats/ao/${id}`}
                      >
                        {ao_name}
                      </Link>
                      <Link
                        className="text-sm"
                        href={`/stats/region/${region_org_id}`}
                      >
                        <span className="text-default-400">{region_name}</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <span className="text-primary">{ao_name}</span>
                      <span className="text-default-400">{region_name}</span>
                    </div>
                  )}
                  {count} beatdown{count !== 1 ? "s" : ""}
                </div>
              )
            )
          ) : (
            <p className="italic text-center text-sm text-default">
              {selected === "aoNameCounts"
                ? "Has not posted to an AO yet"
                : "Has not lead an AO yet"}
            </p>
          )}
        </div>
        </ScrollShadow>
      </CardBody>
    </Card>
  );
}
