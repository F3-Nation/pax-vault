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
                <div className="text-3xl font-bold">PAX Vault — Event Details</div>
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
              This page is live and functioning. You are currently viewing a scaffolded
              Event Details view.
            </p>
            <p className="text-gray-600">
              This page will serve as the central source of truth for an individual event,
              including attendance (PAX), Qs, backblast content, and key event metadata.
            </p>
            <p className="text-gray-600">
              Upcoming iterations will introduce full attendance lists, Q attribution,
              backblast history, and supporting analytics tied directly to this event.
            </p>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-md">
            <CardHeader className="text-xl font-semibold">
              Event Participation
            </CardHeader>
            <CardBody>
              <p className="text-gray-600">
                This section will surface who attended the workout, highlight Q leadership,
                and provide visibility into participation for this specific event.
              </p>
            </CardBody>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="text-xl font-semibold">
              Backblast & Notes
            </CardHeader>
            <CardBody>
              <p className="text-gray-600">
                Backblast content, notes, and follow-up details will live here, preserving
                the story and impact of the workout beyond the beatdown itself.
              </p>
            </CardBody>
          </Card>
        </div>

        <Card className="shadow-md">
          <CardHeader className="text-xl font-semibold">
            Coming Soon: Event Insights
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
