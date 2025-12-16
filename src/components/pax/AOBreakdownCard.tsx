"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { PaxAOBreakdown } from "@/types/pax";
import { formatNumber } from "@/lib/utils";
import { Link } from "@heroui/link";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Tab, Tabs } from "@heroui/tabs";
import { useState } from "react";

export function AOBreakdownCard({
  AOBreakdown,
}: {
  AOBreakdown: PaxAOBreakdown[];
}) {
  const [selected, setSelected] = useState<"asPax" | "asQ">("asPax");

  // Sort data based on the selected view
  const sortedData = [...AOBreakdown].sort((a, b) => {
    if (selected === "asPax") {
      return (b.total_events ?? 0) - (a.total_events ?? 0);
    }
    return (b.total_q_count ?? 0) - (a.total_q_count ?? 0);
  });

  const hasData =
    sortedData.length > 0 &&
    (selected === "asPax"
      ? sortedData.some((ao) => (ao.total_events ?? 0) > 0)
      : sortedData.some((ao) => (ao.total_q_count ?? 0) > 0));

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">AO Breakdown</div>
        <Tabs
          aria-label="Select AO Stats View"
          selectedKey={selected}
          onSelectionChange={(key) => setSelected(key as "asPax" | "asQ")}
          size="sm"
          radius="sm"
          variant="bordered"
          color="primary"
          className="text-default-100"
        >
          <Tab key="asPax" title="As PAX" />
          <Tab key="asQ" title="As Q" />
        </Tabs>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <ScrollShadow className="h-[360px]">
          <div className="space-y-1 text-sm">
            {hasData ? (
              sortedData.map((ao, idx) => {
                const {
                  ao_org_id,
                  ao_name,
                  region_name,
                  region_org_id,
                  total_events,
                  total_q_count,
                } = ao;

                const count =
                  selected === "asPax"
                    ? (total_events ?? 0)
                    : (total_q_count ?? 0);

                if (count === 0) {
                  return null;
                }

                return (
                  <div
                    key={`${ao_org_id ?? "na"}_${idx}`}
                    className={`flex justify-between py-1 pb-2 ${
                      idx !== sortedData.length - 1
                        ? "border-b light:border-black/10 dark:border-white/10"
                        : ""
                    }`}
                  >
                    {ao_org_id ? (
                      <div className="flex gap-2">
                        <Link
                          className="text-sm"
                          color="primary"
                          href={`/stats/ao/${ao_org_id}`}
                        >
                          {ao_name}
                        </Link>
                        {region_org_id && (
                          <Link
                            className="text-sm"
                            href={`/stats/region/${region_org_id}`}
                          >
                            <span className="text-default-400">
                              {region_name}
                            </span>
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <span className="text-primary">{ao_name}</span>
                        <span className="text-default-400">{region_name}</span>
                      </div>
                    )}
                    <span>
                      {formatNumber(count)}{" "}
                      {selected === "asPax"
                        ? `event${count !== 1 ? "s" : ""}`
                        : `event${count !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="italic text-center text-sm text-default">
                {selected === "asPax"
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
