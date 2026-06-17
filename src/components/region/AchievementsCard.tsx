"use client";

/**
 * AchievementsCard
 *
 * Displays upcoming PAX milestones for regional leadership: approaching
 * post/Q counts and FNG anniversaries within the next 14 days.
 *
 * - Scope toggle (Region / Nation) adjusts which post and Q counts are
 *   used for milestone proximity. Anniversaries are scope-independent.
 * - Type filter tabs (All / Posts / Qs / Anniversaries) narrow the list.
 */

import { useMemo, useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Link } from "@heroui/link";
import { Tabs, Tab } from "@heroui/tabs";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Button } from "@heroui/button";
import { RegionAchievementPax } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type AchievementsCardProps = {
  achievements: RegionAchievementPax[];
  filters?: string;
};

type AchievementScope = "region" | "nation";
type AchievementType = "all" | "posts" | "qs" | "anniversaries";

/** A single computed achievement row shown in the card. */
interface AchievementRow {
  user_id: number;
  f3_name: string;
  avatar_url?: string;
  type: "posts" | "qs" | "anniversary";
  milestone: number;
  current: number;
  remaining: number | null; // null for anniversary rows
  anniversary_date: string | null;
  days_until: number | null;
  /** Lower = more urgent; used for sorting */
  urgency: number;
  /** Scope-based post count — used for Q and anniversary rows */
  total_posts?: number;
  /** FNG date string — used for post rows to compute longevity */
  fng_date?: string;
}

const POST_THRESHOLD = 5;
const Q_THRESHOLD = 3;
const ANNIVERSARY_DAYS = 14;

/** Derive achievement rows from raw PAX data for the given scope. */
function computeAchievements(
  achievements: RegionAchievementPax[],
  scope: AchievementScope,
): AchievementRow[] {
  const rows: AchievementRow[] = [];

  for (const pax of achievements) {
    const posts = scope === "nation" ? pax.all_posts : pax.region_posts;
    const qs = scope === "nation" ? pax.all_qs : pax.region_qs;
    const nextPostMilestone =
      scope === "nation"
        ? pax.next_nation_post_milestone
        : pax.next_region_post_milestone;
    const nextQMilestone =
      scope === "nation"
        ? pax.next_nation_q_milestone
        : pax.next_region_q_milestone;

    const recentlyActive =
      pax.last_region_event_date !== null &&
      (new Date().getTime() - new Date(pax.last_region_event_date).getTime()) /
        (1000 * 60 * 60 * 24) <=
        30;

    // Post milestone
    if (
      nextPostMilestone !== null &&
      nextPostMilestone - posts <= POST_THRESHOLD
    ) {
      const remaining = nextPostMilestone - posts;
      if (remaining <= 1 || recentlyActive) {
        rows.push({
          user_id: pax.user_id,
          f3_name: pax.f3_name,
          avatar_url: pax.avatar_url,
          type: "posts",
          milestone: nextPostMilestone,
          current: posts,
          remaining,
          anniversary_date: null,
          days_until: null,
          urgency: remaining,
          fng_date: pax.fng_date ?? undefined,
        });
      }
    }

    // Q milestone
    if (nextQMilestone !== null && nextQMilestone - qs <= Q_THRESHOLD) {
      const remaining = nextQMilestone - qs;
      if (remaining <= 1 || recentlyActive) {
        rows.push({
          user_id: pax.user_id,
          f3_name: pax.f3_name,
          avatar_url: pax.avatar_url,
          type: "qs",
          milestone: nextQMilestone,
          current: qs,
          remaining,
          anniversary_date: null,
          days_until: null,
          urgency: remaining,
          total_posts: posts,
        });
      }
    }

    // Anniversary (scope-independent; shown exactly once per PAX regardless of scope)
    // Require at least 25 region posts so very new PAX don't trigger anniversary notifications.
    if (
      pax.next_anniversary_date &&
      pax.days_until_anniversary !== null &&
      pax.days_until_anniversary >= 0 &&
      pax.days_until_anniversary <= ANNIVERSARY_DAYS &&
      pax.region_posts >= 25
    ) {
      rows.push({
        user_id: pax.user_id,
        f3_name: pax.f3_name,
        avatar_url: pax.avatar_url,
        type: "anniversary",
        milestone: 0, // milestone_value not needed for display; year computed below
        current: 0,
        remaining: null,
        anniversary_date: pax.next_anniversary_date,
        days_until: pax.days_until_anniversary,
        urgency: pax.days_until_anniversary,
        total_posts: posts,
      });
    }
  }

  return rows;
}

/** Format PAX longevity from fng_date to today as "X weeks", "X months", or "X years, Y months". */
function formatLongevity(fngDate: string): string {
  const fng = new Date(fngDate);
  const now = new Date();
  const totalDays = Math.floor(
    (now.getTime() - fng.getTime()) / (1000 * 60 * 60 * 24),
  );
  const totalWeeks = Math.floor(totalDays / 7);

  if (totalWeeks < 8) {
    return `${totalWeeks} week${totalWeeks !== 1 ? "s" : ""}`;
  }

  const years = Math.floor(totalDays / 365.25);
  const remainingMonths = Math.round(((totalDays % 365.25) / 365.25) * 12);

  if (years < 1) {
    const totalMonths = Math.round(totalDays / 30.44);
    return `${totalMonths} month${totalMonths !== 1 ? "s" : ""}`;
  }

  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? "s" : ""}`;
  }
  return `${years} year${years !== 1 ? "s" : ""}, ${remainingMonths} month${remainingMonths !== 1 ? "s" : ""}`;
}

/** Chip color and label by achievement type. */
function typeChip(type: AchievementRow["type"]) {
  if (type === "posts")
    return (
      <Chip size="sm" color="primary" variant="flat">
        Posts
      </Chip>
    );
  if (type === "qs")
    return (
      <Chip size="sm" color="secondary" variant="flat">
        Qs
      </Chip>
    );
  return (
    <Chip size="sm" color="warning" variant="flat">
      Anniversary
    </Chip>
  );
}

/** Human-readable description of a row's milestone. */
function milestoneDescription(row: AchievementRow): string {
  if (row.type === "anniversary" && row.anniversary_date) {
    const dateStr = formatDate(row.anniversary_date, "M D Y");
    const daysStr =
      row.days_until === 0
        ? "today!"
        : row.days_until === 1
          ? "tomorrow"
          : `in ${row.days_until} days`;

    const year = row.current > 0 ? row.current : undefined;
    const yearLabel = year !== undefined ? `${year}-years` : `FNG anniversary`;

    const eventsStr =
      row.total_posts !== undefined ? ` · ${row.total_posts} events` : "";

    return `${yearLabel} — ${dateStr} (${daysStr})${eventsStr}`;
  }

  if (row.type === "qs") {
    const base =
      row.remaining === 1
        ? `1 Q away from ${row.milestone}`
        : `${row.remaining} Qs away from ${row.milestone}`;
    if (row.total_posts !== undefined && row.total_posts > 0) {
      const qRate = Math.round((row.current / row.total_posts) * 100);
      return `${base} · ${row.total_posts} posts, ${qRate}% Q rate`;
    }
    return base;
  }

  // posts
  const base =
    row.remaining === 1
      ? `1 post away from ${row.milestone}`
      : `${row.remaining} posts away from ${row.milestone}`;
  if (row.fng_date) {
    return `${base} · PAX for ${formatLongevity(row.fng_date)}`;
  }
  return base;
}

export function AchievementsCard({
  achievements,
  filters,
}: AchievementsCardProps) {
  const [scope, setScope] = useState<AchievementScope>("region");
  const [typeFilter, setTypeFilter] = useState<AchievementType>("all");

  const allRows = useMemo(
    () => computeAchievements(achievements, scope),
    [achievements, scope],
  );

  const visibleRows = useMemo(() => {
    const filtered =
      typeFilter === "all"
        ? allRows
        : typeFilter === "anniversaries"
          ? allRows.filter((r) => r.type === "anniversary")
          : allRows.filter((r) => r.type === typeFilter);

    // Anniversaries first (by days_until ASC), then count milestones (by remaining ASC), then name
    return [...filtered].sort((a, b) => {
      const aIsAnniv = a.type === "anniversary" ? 0 : 1;
      const bIsAnniv = b.type === "anniversary" ? 0 : 1;
      if (aIsAnniv !== bIsAnniv) return aIsAnniv - bIsAnniv;
      if (a.urgency !== b.urgency) return a.urgency - b.urgency;
      return a.f3_name.localeCompare(b.f3_name);
    });
  }, [allRows, typeFilter]);

  // Compute year for anniversary rows: use fng_date from achievements
  // We annotate anniversary rows with the year at display time.
  const anniversaryYears = useMemo(() => {
    const map = new Map<number, number>();
    for (const pax of achievements) {
      if (pax.fng_date && pax.next_anniversary_date) {
        const fng = new Date(pax.fng_date);
        const anniv = new Date(pax.next_anniversary_date);
        const year = anniv.getUTCFullYear() - fng.getUTCFullYear();
        map.set(pax.user_id, year);
      }
    }
    return map;
  }, [achievements]);

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="font-semibold text-xl">Achievements</div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Tabs
              aria-label="Select achievement scope"
              selectedKey={scope}
              onSelectionChange={(key) => setScope(key as AchievementScope)}
              size="sm"
              radius="sm"
              variant="bordered"
              color="secondary"
            >
              <Tab key="region" title="Region" />
              <Tab key="nation" title="Nation" />
            </Tabs>
            <Dropdown>
              <DropdownTrigger>
                <Button size="md" variant="bordered" color="default">
                  {
                    {
                      all: "All",
                      posts: "Posts",
                      qs: "Qs",
                      anniversaries: "Anniversaries",
                    }[typeFilter]
                  }
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Filter achievement type"
                selectionMode="single"
                selectedKeys={new Set([typeFilter])}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys as Set<string>)[0];
                  setTypeFilter((first ?? "all") as AchievementType);
                }}
              >
                <DropdownItem key="all">All</DropdownItem>
                <DropdownItem key="posts">Posts</DropdownItem>
                <DropdownItem key="qs">Qs</DropdownItem>
                <DropdownItem key="anniversaries">Anniversaries</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <ScrollShadow className="max-h-[60vh]">
          <div className="space-y-1 text-sm">
            {visibleRows.length === 0 ? (
              <div className="italic text-default-500 text-sm py-2">
                No upcoming achievements for this view.
              </div>
            ) : (
              visibleRows.map((row, idx) => {
                // For anniversary rows, replace the computed `current` with the actual year
                const displayRow =
                  row.type === "anniversary"
                    ? {
                        ...row,
                        current:
                          anniversaryYears.get(row.user_id) ?? row.current,
                      }
                    : row;

                return (
                  <div
                    key={`${row.user_id}-${row.type}-${idx}`}
                    className="flex justify-between items-center py-1 pb-2 border-b light:border-black/10 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Avatar
                        alt={row.f3_name ?? row.user_id.toString()}
                        className="flex-shrink-0"
                        size="sm"
                        src={row.avatar_url}
                      />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <Link
                          className="text-sm"
                          color="primary"
                          href={`/stats/pax/${row.user_id}${filters ? `?${filters}` : ""}`}
                        >
                          {row.f3_name ?? row.user_id.toString()}
                        </Link>
                        <span className="text-xs text-default-500 truncate">
                          {milestoneDescription(displayRow)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      {typeChip(row.type)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollShadow>
      </CardBody>
    </Card>
  );
}
