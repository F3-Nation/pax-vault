"use client";

import { Avatar } from "@heroui/avatar";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Link } from "@heroui/link";
import { RegionKotterList } from "@/types/region";
import { formatDate, formatNumber } from "@/lib/utils";

export function KotterCard({ kotters }: { kotters: RegionKotterList[] }) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="flex items-center justify-between w-full">
          <div className="font-semibold text-xl">Kotter List</div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <ScrollShadow className="h-[500px]">
          <div className="space-y-1 text-sm">
            {kotters.map((kotter) => (
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
                <div className="flex flex-col items-end gap-1">
                  <div
                    className={`text-xs ${
                      kotter.kotter_status === "New PAX Drop"
                        ? "text-warning"
                        : kotter.kotter_status === "Veteran Drift"
                          ? "text-danger"
                          : kotter.kotter_status === "Seasonal"
                            ? "text-secondary"
                            : kotter.kotter_status === "Soft Drift"
                              ? "text-primary"
                              : kotter.kotter_status === "Active"
                                ? "text-success"
                                : "text-default-500"
                    }`}
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
