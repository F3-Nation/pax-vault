"use client";

import { Card, CardHeader, CardBody } from "@heroui/card";
import { AOEvents } from "@/types/ao";
import { formatDate, cleanEventName } from "@/lib/utils";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Link } from "@heroui/link";
import { Divider } from "@heroui/divider";

export function RecentEventsCard({ aoEvents }: { aoEvents: AOEvents[] }) {
  aoEvents = aoEvents.slice(0, 10); // Limit to the most recent 10 events
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="text-center font-semibold text-xl px-6">
        Recent Events
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <div
          className={`grid grid-cols-1 gap-6 w-full max-w-6xl ${
            aoEvents.length > 0 ? "mb-6 lg:grid-cols-2" : ""
          }`}
        >
          {aoEvents.length === 0 ? (
            <p className="italic text-center text-sm text-default">
              Has not posted yet
            </p>
            ) : (
            aoEvents.map(
              ({
                id,
                user_id,
                q_ind,
                name,
                ao_name,
                ao_org_id,
                region_name,
                region_org_id,
                start_date,
                f3_name,
                avatar,
                pax_list,
                q_list,
                pax_count,
              }) => (
                <div key={id}>
                  <Card
                    className={`bg-background/60 dark:bg-default-100/50 border ${
                      q_ind === "1"
                        ? "border-secondary"
                        : "border-default-200 dark:border-default-300"
                    }`}
                  >
                    <CardBody className="text-sm">
                      <div className="flex justify-between gap-4">
                        <div className="pb-4 justify-start">
                          <Link href={`/stats/event/${id}`}>
                            <div className="font-semibold text-primary text-lg">
                              {cleanEventName(name)}
                            </div>
                          </Link>
                          <div className="text-default-400">
                            {formatDate(start_date, "M D Y")} @{" "}
                            <Link href={
                              ao_name
                               ? `/stats/ao/${ao_org_id}` 
                               : `/stats/region/${region_org_id}`
                               }
                            >
                              <span className="text-default-400 text-sm italic">
                                {ao_name ?? region_name}
                              </span>
                            </Link>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Chip>{pax_count}</Chip>
                        </div>
                      </div>
                      <div className="flex justify-between gap-2 pb-2">
                        <div className="flex flex-wrap gap-1">
                          <span className="text-medium text-default-500 pr-3">
                            Q:{" "}
                          </span>
                          {q_list ? (
                            q_list
                              .split("###")
                              .filter(Boolean)
                              .map((q, i) => {
                                const [qId, qName, qAvatar] = q.split("|||");
                                return (
                                  <Link
                                    key={`q-${id}-${i}`}
                                    href={`/stats/pax/${qId}`}
                                    className="text-default-100"
                                  >
                                    <Chip
                                      key={`q-${id}-${i}`}
                                      avatar={
                                        <Avatar showFallback src={qAvatar} />
                                      }
                                      variant="bordered"
                                      color="secondary"
                                      size="sm"
                                    >
                                      {qName}
                                    </Chip>
                                  </Link>
                                );
                              })
                          ) : (
                            <Link
                              key={`q-${user_id}`}
                              href={`/stats/pax/${user_id}`}
                              className="text-default-100"
                            >
                              <Chip
                                avatar={
                                  <Avatar showFallback src={avatar ?? ""} />
                                }
                                variant="bordered"
                                color="secondary"
                                size="sm"
                              >
                                {f3_name}
                              </Chip>
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between pb-2">
                        <div className="flex flex-wrap gap-1">
                          <span className="text-medium text-default-500 pr-3">
                            PAX:{" "}
                          </span>
                          {pax_list
                            ? pax_list
                                .split("###")
                                .filter(Boolean)
                                .map((pax, i) => {
                                  const [paxId, paxName, paxAvatar] =
                                    pax.split("|||");
                                  return (
                                    <Link
                                      key={`pax-${id}-${i}`}
                                      href={`/stats/pax/${paxId}`}
                                      className="text-default-100"
                                    >
                                      <Chip
                                        key={`pax-${id}-${i}`}
                                        avatar={
                                          <Avatar
                                            showFallback
                                            src={paxAvatar}
                                          />
                                        }
                                        variant="bordered"
                                        color="default"
                                        size="sm"
                                      >
                                        {paxName}
                                      </Chip>
                                    </Link>
                                  );
                                })
                            : ""}
                          <Link
                            key={`pax-${user_id}`}
                            href={`/stats/pax/${user_id}`}
                            className="text-default-100"
                          >
                            <Chip
                              avatar={
                                <Avatar showFallback src={avatar ?? ""} />
                              }
                              variant="bordered"
                              color="default"
                              size="sm"
                            >
                              {f3_name}
                            </Chip>
                          </Link>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )
            )
          )}
        </div>
      </CardBody>
    </Card>
  );
}
