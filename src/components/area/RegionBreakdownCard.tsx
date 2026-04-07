"use client";

/**
 * RegionBreakdownCard
 *
 * Displays a table of child regions within an Area, each with their
 * aggregate stats. Each region name links to its detail page.
 */

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import { AreaRegionBreakdown } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type RegionBreakdownCardProps = {
  regions: AreaRegionBreakdown[];
};

function renderStat(value?: number, decimals?: number) {
  if (typeof value !== "number") return "—";
  return formatNumber(value, decimals);
}

export function RegionBreakdownCard({ regions }: RegionBreakdownCardProps) {
  if (!regions || regions.length === 0) {
    return (
      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
        <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
          <div className="font-semibold text-xl">Regions</div>
        </CardHeader>
        <Divider />
        <CardBody className="px-6 py-6 text-center text-foreground/50 text-sm">
          No region data available.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Regions</div>
        <div className="text-sm text-foreground/50">
          {regions.length} regions
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-0 py-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-white/10 light:border-black/10">
              <th className="text-left px-6 py-3 font-medium text-foreground/70">
                Region
              </th>
              <th className="text-right px-4 py-3 font-medium text-foreground/70">
                Workouts
              </th>
              <th className="text-right px-4 py-3 font-medium text-foreground/70">
                AOs
              </th>
              <th className="text-right px-4 py-3 font-medium text-foreground/70">
                Active PAX
              </th>
              <th className="text-right px-4 py-3 font-medium text-foreground/70">
                Unique PAX
              </th>
              <th className="text-right px-4 py-3 font-medium text-foreground/70">
                Unique Qs
              </th>
              <th className="text-right px-6 py-3 font-medium text-foreground/70">
                Avg PAX
              </th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region, idx) => (
              <tr
                key={region.region_id}
                className={`border-b dark:border-white/5 light:border-black/5 hover:bg-default-100/40 transition-colors ${
                  idx === regions.length - 1 ? "border-0" : ""
                }`}
              >
                <td className="px-6 py-3">
                  <Link
                    href={`/stats/region/${region.region_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    F3 {region.region_name}
                  </Link>
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(region.event_count)}
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(region.ao_count)}
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(region.active_pax)}
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(region.unique_pax)}
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(region.unique_qs)}
                </td>
                <td className="text-right px-6 py-3">
                  {renderStat(region.pax_count_average, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
