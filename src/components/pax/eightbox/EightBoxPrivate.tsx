/**
 * EightBoxPrivate
 *
 * Shown to a signed-in user who opens someone else's 8 Box overview or
 * editor. Mirrors the region preferences `NotAuthorized` card.
 */

import Link from "next/link";
import { Card, CardBody, CardHeader } from "@heroui/card";

type Props = {
  paxId: number;
  f3Name: string | null;
};

export function EightBoxPrivate({ paxId, f3Name }: Props) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="px-6">
        <h2 className="text-xl font-semibold">This 8 Box is private</h2>
      </CardHeader>
      <CardBody className="gap-4 px-6 text-sm text-foreground/70">
        <p>
          Only <strong>{f3Name ?? "this PAX"}</strong> can see and edit his 8
          Box. If he wants to share a version with you, he can turn on its share
          link and send it to you.
        </p>
        <Link
          href={`/stats/pax/${paxId}`}
          className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Back to PAX page
        </Link>
      </CardBody>
    </Card>
  );
}
