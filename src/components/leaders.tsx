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

import { Leaders } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { Avatar } from "@heroui/avatar";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Tab, Tabs } from "@heroui/tabs";
import { useState } from "react";

type LeadersCardProps = {
  leaders: Leaders[];
  height: number;
  page: "region" | "ao";
  filters?: string;
};

/**
 * Render the numeric value for a leaderboard row based on the active mode.
 */
function renderLeaderValue(
  leader: Leaders,
  scope: "region" | "nation",
  mode: "posts" | "qs",
) {
  const posts = scope === "nation" ? leader.all_posts : leader.posts;
  const qs = scope === "nation" ? leader.all_qs : leader.qs;
  const qRate = posts ? Math.round(((qs ?? 0) / posts) * 100) : 0;

  if (mode === "posts") return `${formatNumber(posts ?? 0)} Posts`;
  return (
    <div className="flex flex-col items-end">
      <span>{formatNumber(qs ?? 0)} Qs</span>
      <span className="text-xs text-default-400">{qRate}% Q Rate</span>
    </div>
  );
}

export function LeadersCard({
  leaders,
  height,
  page,
  filters,
}: LeadersCardProps) {
  // Current leaderboard mode (posts vs Qs)
  const [mode, setMode] = useState<"posts" | "qs">("posts");
  // Scope: Region (this region only) vs Nation (all regions)
  const [scope, setScope] = useState<"region" | "nation">("region");

  // Leaders sorted by the active metric
  const sortedLeaders = [...leaders].sort((a, b) => {
    const aPosts = scope === "nation" ? a.all_posts : a.posts;
    const bPosts = scope === "nation" ? b.all_posts : b.posts;
    const aQs = scope === "nation" ? a.all_qs : a.qs;
    const bQs = scope === "nation" ? b.all_qs : b.qs;
    if (mode === "posts") return (bPosts ?? 0) - (aPosts ?? 0);
    return (bQs ?? 0) - (aQs ?? 0);
  });

  // Hide zero-Q leaders when viewing Q-based metrics
  const visibleLeaders =
    mode === "qs"
      ? sortedLeaders.filter(
          (leader) =>
            (scope === "nation" ? (leader.all_qs ?? 0) : leader.qs) > 0,
        )
      : sortedLeaders;
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="flex items-center justify-between w-full">
          <div className="font-semibold text-xl">Leaders</div>
          <div className="flex items-center gap-2">
            {page === "region" && (
              <Tabs
                aria-label={`Select Leaders Scope`}
                selectedKey={scope}
                onSelectionChange={(key) =>
                  setScope(key as "region" | "nation")
                }
                size="sm"
                radius="sm"
                variant="bordered"
                color="secondary"
                className="text-default-100"
              >
                <Tab key="region" title="Region" />
                <Tab key="nation" title="Nation" />
              </Tabs>
            )}

            <Tabs
              aria-label={`Select Leaders View`}
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
                {renderLeaderValue(leader, scope, mode)}
              </div>
            ))}
          </div>
        </ScrollShadow>
      </CardBody>
    </Card>
  );
}
