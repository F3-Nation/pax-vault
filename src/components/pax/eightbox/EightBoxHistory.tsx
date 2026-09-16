/**
 * EightBoxHistory
 *
 * Published versions, newest first, each linking to its own page. Owner-only
 * surface (the delete button inside it is client-side; the rest is server
 * rendered).
 */

import Link from "next/link";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import type { EightBoxRecord } from "@/lib/bq/eightBox";
import { formatEightBoxDate } from "./EightBoxBoard";
import { EightBoxDeleteButton } from "./EightBoxDeleteButton";

type Props = {
  paxId: number;
  versions: EightBoxRecord[];
};

export function EightBoxHistory({ paxId, versions }: Props) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex flex-col items-start gap-1 px-6">
        <h2 className="text-xl font-semibold">History</h2>
        <p className="text-sm text-foreground/60">
          Every version you&apos;ve published. Open one to view, export, or
          share it.
        </p>
      </CardHeader>
      <Divider />
      <CardBody className="px-2 py-2">
        {versions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-foreground/60">
            Nothing published yet.
          </p>
        ) : (
          <ul className="flex flex-col">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-md px-4 py-2.5 hover:bg-default-100/60"
              >
                <Link
                  href={`/stats/pax/${paxId}/8box/${v.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    v{v.version}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {v.period}
                  </span>
                  <span className="hidden text-xs text-foreground/50 sm:inline">
                    {formatEightBoxDate(v.publishedAt)}
                  </span>
                  {v.sharedAt && (
                    <Chip size="sm" color="success" variant="flat">
                      Shared
                    </Chip>
                  )}
                </Link>
                <EightBoxDeleteButton
                  paxId={paxId}
                  versionId={v.id}
                  label={`version ${v.version} (${v.period})`}
                  kind="published"
                />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
