import Link from "next/link";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";

export default function App() {
  const environment =
    process.env.ENVIRONMENT === "production" ? "Production" : "Staging";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-default-50 px-4">
      <Card
        className="w-full max-w-3xl bg-background/80 dark:bg-default-100/60"
        shadow="lg"
      >
        <CardHeader className="flex flex-col gap-3">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-3xl font-bold tracking-tight">PAX Vault</h1>
            <Chip
              size="sm"
              color={environment === "Production" ? "success" : "warning"}
              variant="flat"
            >
              {environment} Environment
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

          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-xs text-foreground/60 text-center">
              Jump into some sample data to see how PAX Vault works.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:justify-center">
              <Link
                href={`/stats/pax/${process.env.SAMPLE_PAX ?? ""}`}
                className="flex-1 sm:flex-none"
              >
                <Button fullWidth variant="bordered" color="secondary">
                  View Sample PAX Stats
                </Button>
              </Link>

              <Link
                href={`/stats/region/${process.env.SAMPLE_REGION ?? ""}`}
                className="flex-1 sm:flex-none"
              >
                <Button fullWidth variant="bordered" color="primary">
                  View Sample Region Dashboard
                </Button>
              </Link>

              {/* Uncomment when you are ready to surface AO sample stats */}
              {/* <Link href={`/stats/ao/${process.env.SAMPLE_AO ?? ""}`} className="flex-1 sm:flex-none">
                <Button
                  fullWidth
                  variant="bordered"
                  color="secondary"
                >
                  View Sample AO Stats
                </Button>
              </Link> */}
            </div>
          </div>
        </CardBody>

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
