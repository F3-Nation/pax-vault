"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Link } from "@heroui/link";
import { PaxEventsResults } from "@/types/pax";
import { Tab, Tabs } from "@heroui/tabs";
import { useState } from "react";
import { Divider } from "@heroui/divider";

type EventsResult = {
  uniquePax?: {
    most_attended_user_event_count: number;
    most_attended_user_id: string;
    most_attended_user_name: string;
    total_unique_other_attendees: number;
    unique_attendees_when_q: number;
  };
};

export function PAXSummaryCard({
  paxData,
  eventsResult,
}: {
  paxData: PaxEventsResults | null;
  eventsResult: EventsResult;
}) {
  const [selected, setSelected] = useState("nation");
  const totalEvents =
    paxData?.[selected as keyof typeof paxData]?.totalEvents ?? 0;
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="font-semibold text-xl">PAX Summary</div>
        <Tabs
          aria-label="Select Workout Summary View"
          selectedKey={selected}
          onSelectionChange={(key) => setSelected(key as string)}
          size="sm"
          radius="sm"
          variant="bordered"
          color="primary"
          className="text-default-100"
        >
          <Tab key="nation" title="All"></Tab>
          <Tab key="region" title="Region Only"></Tab>
        </Tabs>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <div className="space-y-1 text-sm">
          {totalEvents === 0 ? (
            <p className="italic text-center text-sm text-default">
              Has not posted yet
            </p>
          ) : (
            <>
              <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
                <span className="text-primary">Total Posts:</span>
                <span>{totalEvents}</span>
              </div>
              <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
                <span className="text-primary">Total Qs:</span>
                <span>
                  {(paxData?.[selected as keyof typeof paxData]?.totalQ ?? 0) >
                  0
                    ? paxData?.[selected as keyof typeof paxData]?.totalQ
                    : "Has not been the Q yet"}
                </span>
              </div>
              <div
                className={`flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10`}
              >
                <span className="text-primary">Bestie:</span>
                <span>
                  {eventsResult?.uniquePax?.most_attended_user_event_count ?? 0}{" "}
                  BDs with{" "}
                  <Link
                    className="text-sm"
                    color="secondary"
                    href={`/stats/pax/${eventsResult?.uniquePax?.most_attended_user_id}`}
                  >
                    {eventsResult?.uniquePax?.most_attended_user_name}
                  </Link>
                </span>
              </div>
              <>
                <div
                  className={`flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10`}
                >
                  <span className="text-primary">First BD:</span>
                  <span>
                    {paxData?.[selected as keyof typeof paxData]?.firstBD ?? 0}{" "}
                    at{" "}
                    <Link
                      className="text-sm"
                      color="secondary"
                      href={`/stats/ao/${
                        paxData?.[selected as keyof typeof paxData]
                          ?.firstBDLocation?.id
                      }`}
                    >
                      {
                        paxData?.[selected as keyof typeof paxData]
                          ?.firstBDLocation?.name
                      }
                    </Link>
                  </span>
                </div>
                <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
                  <span className="text-primary">Last Seen:</span>
                  <span>
                    {paxData?.[selected as keyof typeof paxData]?.lastBD ?? 0}{" "}
                    at{" "}
                    <Link
                      className="text-sm"
                      color="secondary"
                      href={`/stats/ao/${
                        paxData?.[selected as keyof typeof paxData]
                          ?.lastBDLocation?.id
                      }`}
                    >
                      {
                        paxData?.[selected as keyof typeof paxData]
                          ?.lastBDLocation?.name
                      }
                    </Link>
                  </span>
                </div>
                <div
                  className={`flex justify-between py-1 pb-2 ${
                    (paxData?.[selected as keyof typeof paxData]?.totalQ ?? 0) >
                    0
                      ? "border-b light:border-black/10 dark:border-white/10"
                      : ""
                  }`}
                >
                  <span className="text-primary">Unique PAX Met:</span>
                  <span>
                    {eventsResult?.uniquePax?.total_unique_other_attendees ?? 0}{" "}
                    PAX
                  </span>
                </div>
              </>
              {(paxData?.[selected as keyof typeof paxData]?.totalQ ?? 0) >
                0 && (
                <>
                  <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
                    <span className="text-primary">First Q:</span>
                    <span>
                      {paxData?.[selected as keyof typeof paxData]?.firstQ ?? 0}{" "}
                      at{" "}
                      <Link
                        className="text-sm"
                        color="secondary"
                        href={`/stats/ao/${
                          paxData?.[selected as keyof typeof paxData]
                            ?.firstQLocation?.id
                        }`}
                      >
                        {
                          paxData?.[selected as keyof typeof paxData]
                            ?.firstQLocation?.name
                        }
                      </Link>
                    </span>
                  </div>
                  <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
                    <span className="text-primary">Most Recent Q:</span>
                    <span>
                      {paxData?.[selected as keyof typeof paxData]?.lastQ ?? 0}{" "}
                      at{" "}
                      <Link
                        className="text-sm"
                        color="secondary"
                        href={`/stats/ao/${
                          paxData?.[selected as keyof typeof paxData]
                            ?.lastQLocation?.id
                        }`}
                      >
                        {
                          paxData?.[selected as keyof typeof paxData]
                            ?.lastQLocation?.name
                        }
                      </Link>
                    </span>
                  </div>
                  <div className={`flex justify-between py-1 pb-2`}>
                    <span className="text-primary">Unique PAX Led:</span>
                    <span>
                      {eventsResult?.uniquePax?.unique_attendees_when_q ?? 0}{" "}
                      PAX
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
