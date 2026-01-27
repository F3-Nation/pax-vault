"use client";

/**
 * LeadersCard
 *
 * Displays a leaderboard of region leaders, sortable by Posts or Qs.
 *
 * This component is purely presentational:
 * - Sorting and filtering are handled client-side.
 * - Data is assumed to be validated upstream.
 */

import { useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";
import { Avatar } from "@heroui/avatar";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Link } from "@heroui/link";
import { Leaders } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type LeadersCardProps = {
  leaders: Leaders[];
  height: number;
  title?: string;
  filters?: string;
};

/**
 * Render the numeric value for a leaderboard row based on the active mode.
 */
function renderLeaderValue(leader: Leaders, mode: "posts" | "qs") {
  return mode === "posts"
    ? `${formatNumber(leader.posts)} Posts`
    : `${formatNumber(leader.qs)} Qs`;
}

export function LeadersCard({
  leaders,
  height,
  title,
  filters,
}: LeadersCardProps) {
  // Current leaderboard mode (posts vs Qs)
  const [mode, setMode] = useState<"posts" | "qs">("posts");

  // Leaders sorted by the active metric
  const sortedLeaders = [...leaders].sort((a, b) => {
    if (mode === "posts") return b.posts - a.posts;
    return b.qs - a.qs;
  });

  // Hide zero-Q leaders when viewing Qs
  const visibleLeaders =
    mode === "qs"
      ? sortedLeaders.filter((leader) => leader.qs > 0)
      : sortedLeaders;
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="flex items-center justify-between w-full">
          <div className="font-semibold text-xl">
            {title ? `${title} Leaderboard` : "Leaderboard"}
          </div>
          <Tabs
            aria-label={`Select ${title ? `${title} Leaders View` : ""}Leaders View`}
            selectedKey={mode}
            onSelectionChange={(key) => setMode(key as "posts" | "qs")}
            size="sm"
            radius="sm"
            variant="bordered"
            color="primary"
            className="text-default-100"
          >
            <Tab key="posts" title="Posts" />
            <Tab key="qs" title="Qs" />
          </Tabs>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <ScrollShadow style={{ height }} className="w-full">
          <div className="space-y-1 text-sm overflow-y-auto">
            {visibleLeaders.map((leader) => (
              <div
                key={leader.user_id}
                className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Avatar
                    alt={leader.f3_name ?? leader.user_id.toString()}
                    className="flex-shrink-0 w-5 h-5"
                    size="sm"
                    src={leader.avatar_url}
                  />
                  <Link
                    className="text-sm"
                    color="primary"
                    href={`/stats/pax/${leader.user_id}${filters ? `?${filters}` : ""}`}
                  >
                    {leader.f3_name ?? leader.user_id.toString()}
                  </Link>
                </div>
                {renderLeaderValue(leader, mode)}
              </div>
            ))}
          </div>
        </ScrollShadow>
      </CardBody>
    </Card>
  );
}
