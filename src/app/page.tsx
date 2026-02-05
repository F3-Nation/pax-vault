/**
 * Application landing page.
 *
 * Responsibilities:
 * - Communicate what PAX Vault is and who it is for.
 * - Surface environment context (Production vs Staging).
 * - Provide quick entry points into sample PAX and Region data.
 */
import Link from "next/link";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import AuthCard from "@/components/auth/AuthCard";
import { Suspense } from "react";

/**
 * Resolve a human-readable environment label from runtime configuration.
 */
function getEnvironmentLabel(): "Production" | "Staging" {
  return process.env.ENVIRONMENT === "production" ? "Production" : "Staging";
}

export default function App() {
  const environmentLabel = getEnvironmentLabel();

  const samplePaxId = process.env.SAMPLE_PAX ?? "";
  const sampleRegionId = process.env.SAMPLE_REGION ?? "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-default-50 px-4">
      {/* Main marketing card */}
      <Card
        className="w-full max-w-3xl bg-background/80 dark:bg-default-100/60"
        shadow="lg"
      >
        <CardHeader className="flex flex-col gap-3">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-3xl font-bold tracking-tight">PAX Vault</h1>
            <Chip
              size="sm"
              color={environmentLabel === "Production" ? "success" : "warning"}
              variant="flat"
            >
              {environmentLabel} Environment
            </Chip>
          </div>
          <p className="text-sm text-foreground/70 max-w-xl">
            A focused stats and history vault for F3 PAX, AOs, and Regions.
            Track workouts, Qs, attendance, and leadership impact in one place —
            built for Site Qs, Nantan, and data nerds who actually care about
            the numbers.
          </p>
        </CardHeader>

        <CardBody className="space-y-6">
          {/* Feature highlights */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card
              className="bg-default-50/80 dark:bg-default-100/80"
              shadow="none"
            >
              <CardBody className="gap-2">
                <Chip size="sm" variant="flat">
                  PAX Focused
                </Chip>
                <h2 className="text-sm font-semibold">Individual Stats</h2>
                <p className="text-xs text-foreground/70">
                  See streaks, attendance, Q history, and region impact per PAX
                  with clean, drill-down views.
                </p>
              </CardBody>
            </Card>

            <Card
              className="bg-default-50/80 dark:bg-default-100/80"
              shadow="none"
            >
              <CardBody className="gap-2">
                <Chip size="sm" variant="flat">
                  AO &amp; Region
                </Chip>
                <h2 className="text-sm font-semibold">Leadership Views</h2>
                <p className="text-xs text-foreground/70">
                  Understand AO health, Q coverage, and growth trends across
                  your region at a glance.
                </p>
              </CardBody>
            </Card>

            <Card
              className="bg-default-50/80 dark:bg-default-100/80"
              shadow="none"
            >
              <CardBody className="gap-2">
                <Chip size="sm" variant="flat">
                  Data-Driven
                </Chip>
                <h2 className="text-sm font-semibold">Purpose Built</h2>
                <p className="text-xs text-foreground/70">
                  Designed around F3 language and workflows — not generic
                  fitness tracking.
                </p>
              </CardBody>
            </Card>
          </div>
          <div className="pt-6">
            <Suspense fallback={null}>
              <AuthCard />
            </Suspense>
          </div>
          {/* Sample data entry points */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-xs text-foreground/60 text-center">
              Jump into some sample data to see how PAX Vault works.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:justify-center">
              <Link
                href={`/stats/pax/${samplePaxId}`}
                className="flex-1 sm:flex-none"
              >
                <Button fullWidth variant="bordered" color="secondary">
                  View Sample PAX Stats
                </Button>
              </Link>

              <Link
                href={`/stats/region/${sampleRegionId}`}
                className="flex-1 sm:flex-none"
              >
                <Button fullWidth variant="bordered" color="primary">
                  View Sample Region Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </CardBody>

        {/* Footer copy */}
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-default-100/60">
          <p className="text-[11px] text-foreground/50">
            Built for F3 regions that want real visibility into their PAX and
            AOs.
          </p>
          <p className="text-[11px] text-foreground/50">
            Ready for your data? Connect your region&apos;s feed and go.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
