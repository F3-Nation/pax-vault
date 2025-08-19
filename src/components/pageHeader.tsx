"use client";

import { Avatar } from "@heroui/avatar";
import { Card, CardHeader } from "@heroui/card";
import { Link } from "@heroui/link";

export function PageHeader({
  image,
  name,
  link,
  linkName,
}: {
  image?: string;
  name?: string;
  link?: string;
  linkName?: string;
}) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50 w-full">
      <CardHeader className="flex justify-between items-center">
        <Avatar
          src={image ?? "https://placehold.in/300x200.png"}
          alt={name}
          radius="md"
          className="w-16 h-16"
        />
        <div className="text-right">
          <div className="text-right text-xl font-bold">{name}</div>
          <Link href={link ?? "#"} color="primary">
            {linkName}
          </Link>
        </div>
      </CardHeader>
    </Card>
  );
}
