"use client";

/**
 * KotterCard
 *
 * Displays a scrollable, filterable list of Kotters for a region.
 * Users can filter by kotter status and navigate to PAX / AO detail pages.
 */

import { useMemo, useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Link } from "@heroui/link";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Button } from "@heroui/button";
import { RegionKotterList } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

type KotterCardProps = {
  kotters: RegionKotterList[];
};

export function KotterCard({ kotters }: KotterCardProps) {
  // Current status filter; "all" disables filtering.
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Derive unique, sorted status values from the dataset.
  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const k of kotters) {
      if (k.kotter_status) set.add(k.kotter_status);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [kotters]);

  // Apply the active status filter to the kotter list.
  const filteredKotters = useMemo(() => {
    if (statusFilter === "all") return kotters;
    return kotters.filter((k) => k.kotter_status === statusFilter);
  }, [kotters, statusFilter]);

  /**
   * Map a kotter status to a semantic text color.
   */
  const getStatusClass = (status?: string) => {
    const s = (status || "").toLowerCase();

    if (s === "inactive") return "text-default-500";
    if (s === "new pax drop") return "text-warning";
    if (s === "seasonal") return "text-secondary";
    if (s === "soft drift") return "text-primary";
    if (s === "veteran drift") return "text-danger";
    if (s === "active") return "text-success";

    return "text-default-500";
  };

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="font-semibold text-xl">Kotter List</div>

          <div className="flex items-center gap-2">
            <Dropdown>
              <DropdownTrigger>
                <Button size="md" variant="bordered" color="default">
                  <span
                    className={
                      statusFilter === "all"
                        ? "text-default-500"
                        : getStatusClass(statusFilter)
                    }
                  >
                    {statusFilter === "all" ? "All statuses" : statusFilter}
                  </span>
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Filter kotters by status"
                selectionMode="single"
                selectedKeys={new Set([statusFilter])}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys as Set<string>)[0];
                  setStatusFilter(first ?? "all");
                }}
              >
                {[
                  <DropdownItem key="all">All statuses</DropdownItem>,
                  ...statusOptions.map((s) => (
                    <DropdownItem key={s} className={getStatusClass(s)}>
                      {s}
                    </DropdownItem>
                  )),
                ]}
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {/* Scrollable list to cap card height while keeping headers visible */}
        <ScrollShadow className="h-[500px]">
          <div className="space-y-1 text-sm">
            {filteredKotters.length === 0 ? (
              <div className="italic text-default-500 text-sm">
                No kotters match this status.
              </div>
            ) : null}
            {filteredKotters.map((kotter) => (
              <div
                key={kotter.user_id}
                className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10"
              >
                <div className="flex items-center text-sm">
                  <div className="flex items-center text-sm gap-2">
                    <Avatar
                      alt={kotter.f3_name ?? kotter.user_id.toString()}
                      size="md"
                      src={kotter.avatar_url}
                    />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center">
                        <Link
                          className="text-sm"
                          color="primary"
                          href={`/stats/pax/${kotter.user_id}`}
                        >
                          {kotter.f3_name ?? kotter.user_id.toString()}
                        </Link>
                      </div>
                      <div className="text-xs text-default-500">
                        Last seen {formatDate(kotter.last_event_date, "M D Y")}{" "}
                        @{" "}
                        <span className="italic">
                          <Link
                            className="text-xs italic text-default-500"
                            href={`/stats/ao/${kotter.last_event_ao_org_id}`}
                          >
                            {kotter.last_event_ao_name}
                          </Link>
                        </span>
                      </div>
                      <div className="text-xs text-secondary">
                        {kotter.bestie_list.map((bestie, idx) => {
                          return (
                            <div
                              key={`${kotter.user_id}-${bestie.user_id}-${idx}`}
                              className="inline-flex items-center"
                            >
                              <Link
                                key={`${kotter.user_id}-${bestie.user_id}-${idx}`}
                                href={`/stats/pax/${bestie.user_id}`}
                                className="text-secondary text-xs"
                              >
                                {bestie.f3_name ?? bestie.user_id.toString()}
                              </Link>
                              {idx !== kotter.bestie_list.length - 1 && (
                                <span className="mx-1">•</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <div
                    className={`text-xs ${getStatusClass(kotter.kotter_status)}`}
                  >
                    {kotter.kotter_status}
                  </div>
                  <div className="text-xs text-default-500 text-right">
                    {kotter.days_since_last_event} days ago
                  </div>
                  <div className="text-xs text-default-500 text-right">
                    {formatNumber(kotter.total_events)} events
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollShadow>
      </CardBody>
    </Card>
  );
}
