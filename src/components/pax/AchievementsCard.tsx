"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Avatar } from "@heroui/avatar";
import { Tooltip } from "@heroui/tooltip";
import { Badge } from "@heroui/badge";
import { PaxAchievements } from "@/types/pax";
import { formatDate } from "@/lib/utils";

export function AchievementsCard({
  achievements,
}: {
  achievements: PaxAchievements[];
}) {
  return (
    (
      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
        <CardHeader className="text-center font-semibold text-xl px-6">
          Achievements
        </CardHeader>
        <Divider />
        <CardBody className="px-6">
          {achievements.length === 0 ? (
            <div className="text-center italic text-default text-sm">
              No achievements earned
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4">
              {achievements.map((achievement, i) => {
                const hasBadge = achievement.times > 1;
                const imgSrc = achievement.image_url
                  ? achievement.image_url
                  : `/sample-badge.png`;
                const key = `${achievement.achievement_id}-${i}`;
                return (
                  <div key={key}>
                    <div className="items-center">
                      <Badge
                        isInvisible={!hasBadge}
                        color="primary"
                        className="text-default-100"
                        content={achievement.times}
                        placement="bottom-right"
                        size={i + 1 >= 10 ? "sm" : "md"}
                      >
                        <Tooltip
                          content={
                            <div className="px-1 py-2">
                              <div className="text-sm font-semibold">
                                {achievement.description}
                              </div>
                              <div className="text-xs italic">
                                Last Earned:{" "}
                                {formatDate(achievement.date_awarded, "M D Y")}
                              </div>
                            </div>
                          }
                          color="primary"
                          className="text-default-100"
                        >
                          <Avatar
                            // isBordered
                            color={
                              achievement.specific_org_id
                                ? "secondary"
                                : "default"
                            }
                            radius="sm"
                            src={achievement.image_url || imgSrc}
                            alt={achievement.name}
                            // size="lg"
                            className="w-24 h-24 bg-transparent"
                          />
                        </Tooltip>
                      </Badge>
                    </div>
                    <div className="text-center italic text-sm text-default-500">
                      {achievement.name}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    )
  );
}
