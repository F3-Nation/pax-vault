"use client";

/**
 * KingCell
 *
 * Renders a "King" leaderboard value for an AO/Region/Area/Sector summary —
 * the PAX with the most of some attendance metric (fartsacks, ghosts, ...) at
 * that scope. Handles ties by listing every PAX at the top count.
 *
 * - 0 tied PAX  -> "No PAX"
 * - 1 PAX       -> a link to the PAX + their count
 * - 2+ tied PAX -> "N PAX" with a tap/click Popover listing each PAX + count
 */

import { Link } from "@heroui/link";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { PaxLeader } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function KingCell({
  leaders,
  filters,
}: {
  leaders?: PaxLeader[] | null;
  filters?: string;
}) {
  const list = leaders ?? [];
  const href = (id: number) =>
    `/stats/pax/${id}${filters ? `?${filters}` : ""}`;

  if (list.length === 0) {
    return <>No PAX</>;
  }

  if (list.length === 1) {
    const king = list[0];
    return (
      <>
        <Link className="text-sm" color="secondary" href={href(king.user_id)}>
          {king.f3_name || "Unknown PAX"}
        </Link>
        {` (${formatNumber(king.count)})`}
      </>
    );
  }

  // Tie: show "N PAX" and reveal the tied PAX (with counts) in a popover.
  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <span className="cursor-pointer text-secondary underline decoration-dotted underline-offset-2">
          {list.length} PAX
        </span>
      </PopoverTrigger>
      <PopoverContent className="max-w-[260px] p-2 text-sm">
        <div className="flex w-full flex-col gap-1">
          {list.map((king) => (
            <div
              key={king.user_id}
              className="flex items-center justify-between gap-4"
            >
              <Link
                className="text-sm"
                color="secondary"
                href={href(king.user_id)}
              >
                {king.f3_name || "Unknown PAX"}
              </Link>
              <span>{formatNumber(king.count)}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
