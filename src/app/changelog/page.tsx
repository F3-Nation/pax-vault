/**
 * Public changelog page (/changelog).
 *
 * Plain-language, user-facing history of PAX Vault. Public — not behind auth
 * (the middleware only guards /stats and expensive APIs). Content lives in
 * `@/lib/changelog` so it stays in sync with the repo CHANGELOG.md.
 */
import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { CHANGELOG, type ChangeTag } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What's new in PAX Vault — features, improvements, and fixes.",
};

const TAG_COLOR: Record<ChangeTag, "success" | "primary" | "warning"> = {
  Added: "success",
  Improved: "primary",
  Fixed: "warning",
};

export default function ChangelogPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-background to-default-50 px-4 pt-10 pb-16">
      <div className="w-full max-w-3xl space-y-6">
        {/* Intro */}
        <Card className="bg-background/80 dark:bg-default-100/60" shadow="lg">
          <CardHeader className="flex flex-col items-start gap-2 px-6">
            <h1 className="text-3xl font-bold tracking-tight">Changelog</h1>
            <p className="text-sm text-foreground/70">
              What&apos;s new in PAX Vault — new pages, search, filters, stats,
              and fixes, in plain language. Newest first.
            </p>
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <p className="text-xs text-foreground/60">
              A few terms: <strong>PAX</strong> (a participant),{" "}
              <strong>Q</strong> (workout leader), <strong>AO</strong> (workout
              location), <strong>FNG</strong> (first-timer),{" "}
              <strong>ghost</strong> (posted without signing up),{" "}
              <strong>fartsack</strong> (signed up but didn&apos;t show).
            </p>
          </CardBody>
        </Card>

        {/* Releases */}
        {CHANGELOG.map((release) => (
          <Card
            key={release.period}
            className="bg-background/60 dark:bg-default-100/50"
            shadow="md"
          >
            <CardHeader className="flex items-baseline justify-between px-6">
              <h2 className="text-xl font-semibold">{release.title}</h2>
              <span className="text-sm text-foreground/60">
                {release.period}
              </span>
            </CardHeader>
            <Divider />
            <CardBody className="space-y-4 px-6">
              {release.sections.map((section) => (
                <div key={section.tag} className="space-y-2">
                  <Chip size="sm" variant="flat" color={TAG_COLOR[section.tag]}>
                    {section.tag}
                  </Chip>
                  <ul className="ml-1 space-y-1.5">
                    {section.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-sm text-foreground/80"
                      >
                        <span className="select-none text-foreground/30">
                          •
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    </main>
  );
}
