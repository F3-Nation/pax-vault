"use client";

/**
 * AreaBreakdownCard
 *
 * Displays a table of child areas within a Sector, each with their
 * aggregate stats. Each area name links to its detail page.
 */

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import { SectorAreaBreakdown } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type AreaBreakdownCardProps = {
  areas: SectorAreaBreakdown[];
};

function renderStat(value?: number, decimals?: number) {
  if (typeof value !== "number") return "—";
  return formatNumber(value, decimals);
}

export function AreaBreakdownCard({ areas }: AreaBreakdownCardProps) {
  if (!areas || areas.length === 0) {
    return (
      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
        <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
          <div className="font-semibold text-xl">Areas</div>
        </CardHeader>
        <Divider />
        <CardBody className="px-6 py-6 text-center text-foreground/50 text-sm">
          No area data available.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Areas</div>
        <div className="text-sm text-foreground/50">{areas.length} areas</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-0 py-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-white/10 light:border-black/10">
              <th className="text-left px-6 py-3 font-medium text-foreground/70">
                Area
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
            {areas.map((area, idx) => (
              <tr
                key={area.area_id}
                className={`border-b dark:border-white/5 light:border-black/5 hover:bg-default-100/40 transition-colors ${
                  idx === areas.length - 1 ? "border-0" : ""
                }`}
              >
                <td className="px-6 py-3">
                  <Link
                    href={`/stats/area/${area.area_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    F3 {area.area_name}
                  </Link>
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(area.event_count)}
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(area.ao_count)}
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(area.active_pax)}
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(area.unique_pax)}
                </td>
                <td className="text-right px-4 py-3">
                  {renderStat(area.unique_qs)}
                </td>
                <td className="text-right px-6 py-3">
                  {renderStat(area.pax_count_average, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
