"use client";

import { useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";
import { Avatar } from "@heroui/avatar";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Link } from "@heroui/link";
import { AOLeaders } from "@/types/ao";

export function AOLeadersCard({ leaders }: { leaders: AOLeaders[] }) {
  const [mode, setMode] = useState<"posts" | "qs">("posts");
  const sortedLeaders = [...leaders].sort((a, b) => {
    if (mode === "posts") return b.posts - a.posts;
    return b.qs - a.qs;
  });

  const visibleLeaders =
    mode === "qs"
      ? sortedLeaders.filter((leader) => leader.qs > 0)
      : sortedLeaders;
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="flex items-center justify-between w-full">
          <div className="font-semibold text-xl">AO Leaderboards</div>
          <Tabs
            aria-label="Select AO Leaders View"
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
        <ScrollShadow className="h-[260px]">
          <div className="space-y-1 text-sm">
            {visibleLeaders.map((leader) => (
              <div
                key={leader.user_id}
                className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Avatar
                    alt={leader.f3_name}
                    className="flex-shrink-0 w-5 h-5"
                    size="sm"
                    src={leader.avatar_url}
                  />
                  <Link
                    className="text-sm"
                    color="primary"
                    href={`/stats/pax/${leader.user_id}`}
                  >
                    {leader.f3_name}
                  </Link>
                </div>
                {mode === "posts" ? `${leader.posts} Posts` : `${leader.qs} Qs`}
              </div>
            ))}
          </div>
        </ScrollShadow>
      </CardBody>
    </Card>
  );
}
