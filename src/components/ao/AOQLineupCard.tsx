"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { AOQLineup } from "@/types/ao";
import { formatDate, formatTime } from "@/lib/utils";
import { Link } from "@heroui/link";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { ScrollShadow } from "@heroui/scroll-shadow";

export function AOQLineupCard({
  lineup,
}: {
  lineup: AOQLineup[];
}) {
    lineup = lineup.slice(0, 10); // Limit to the most recent 10 events
  return (

      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="flex justify-between items-center px-6">
            <div className="font-semibold text-xl">Q Lineup</div>
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <ScrollShadow className="h-[300px]"> 
            {(lineup.length === 0) ? (
                <p className="italic text-center text-sm text-default">
                  No Q Lineup data available
                </p>
            ) :  (
                lineup.map((item, index) => (
                <div
                    key={index}
                    className="flex justify-between items-center py-1 pb-2 border-b light:border-black/10 dark:border-white/10 last:border-b-0"
                >
                    <div className="flex flex-col">
                        <Link href={`https://www.google.com/maps/search/?api=1&query=${item.latitude}%2C${item.longitude}`} target="_blank" rel="noopener noreferrer">
                            <div className="text-primary">
                                {item.location_name}
                            </div>
                        </Link>
                        <span className="text-left text-sm text-default-400">{formatDate(item.start_date, "M D Y")} @ {formatTime(item.start_time)} [{item.event_types}]</span>
                        </div>
                    <div>
                        {item.q_who ? (
                            <Link
                                key={`q-${item.q_list?.[0]?.user_id}`}
                                href={`/stats/pax/${item.q_list?.[0]?.user_id}`}
                                className="text-default-100"
                            >
                                <Chip
                                    avatar={<Avatar showFallback src={item.q_list?.[0]?.avatar_url} />}
                                    variant="bordered"
                                    color="secondary"
                                >
                                    {item.q_who}
                                </Chip>
                            </Link>
                        ) : (
                            <Chip
                                variant="bordered"
                                color="danger"
                            >
                                Needs a Q
                            </Chip>
                        )}
                    </div>
                    
                </div>
            )))}
            </ScrollShadow>
          </CardBody>
        </Card>
  );
}
