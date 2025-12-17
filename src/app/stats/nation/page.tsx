"use client";

import { Card, CardHeader, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";
import { Skeleton } from "@heroui/skeleton";

export default function PlaceholderPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-default-50 px-4">
      <div className="w-full max-w-4xl space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="w-full flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-3xl font-bold">
                  PAX Vault — Nation Stats
                </div>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-full bg-warning animate-pulse"
                  />
                  <Chip color="warning" variant="flat">
                    Under Construction
                  </Chip>
                </div>
              </div>
              <Progress
                aria-label="Build progress"
                value={35}
                showValueLabel
                className="max-w-md"
              />
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-gray-700">
              This page is live and functioning. You are currently viewing a
              scaffolded stats view.
            </p>
            <p className="text-gray-600">
              This page will serve as a central view for nationwide statistics,
              providing insight into trends, participation, and growth across
              all regions.
            </p>
            <p className="text-gray-600">
              Upcoming iterations will introduce real data, interactive
              filtering, and composable analytics focused on Nation-level
              visibility and decision-making.
            </p>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-md">
            <CardHeader className="text-xl font-semibold">
              Nationwide Visibility
            </CardHeader>
            <CardBody>
              <p className="text-gray-600">
                This view will aggregate data across all regions to surface
                meaningful Nation-wide metrics and patterns that are not visible
                at the local level.
              </p>
            </CardBody>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="text-xl font-semibold">
              Data-Driven Design
            </CardHeader>
            <CardBody>
              <p className="text-gray-600">
                Nation-level statistics will help identify long-term trends,
                regional differences, and opportunities for growth across the
                organization.
              </p>
            </CardBody>
          </Card>
        </div>

        <Card className="shadow-md">
          <CardHeader className="text-xl font-semibold">
            Coming Soon: Nation Metrics
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-default-200 bg-background p-4 space-y-3"
                >
                  <Skeleton className="h-4 w-2/3 rounded-lg" />
                  <Skeleton className="h-8 w-1/2 rounded-lg" />
                  <Skeleton className="h-3 w-full rounded-lg" />
                  <Skeleton className="h-3 w-5/6 rounded-lg" />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-default-200 bg-background p-4 space-y-3">
              <Skeleton className="h-4 w-1/3 rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
