/**
 * Application landing page.
 *
 * This is the only public surface of the app (middleware bounces every
 * `/stats/*` route back to here), so it has to do the whole selling job on its
 * own:
 *
 * - Explain what PAX Vault is, in F3 language.
 * - Show — not just describe — the product, via static preview mockups that
 *   need no auth and no BigQuery round-trip.
 * - Route visitors into the F3 Nation sign-in.
 *
 * Sample PAX / Region links live in `HeroActions` and only render for
 * signed-in users, since those routes require a session.
 *
 * Color note: `tailwind.config.ts` maps the brand colors to bare `var(--…)`
 * values, so Tailwind cannot emit opacity modifiers for them (`text-primary/50`
 * compiles to nothing). Muted text here uses HeroUI's `default-*` scale, which
 * does support alpha.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import AuthCard from "@/components/auth/AuthCard";
import HeroActions from "@/components/landing/HeroActions";
import { HierarchyDiagram } from "@/components/landing/HierarchyDiagram";
import {
  AchievementsPreview,
  FiltersPreview,
  FngChartPreview,
  HeatmapPreview,
  LeaderboardPreview,
  PaxCardPreview,
  SearchPreview,
  TrendChartPreview,
} from "@/components/landing/previews";
import { F3LogoIcon } from "@/components/icons";

export const metadata: Metadata = {
  description:
    "PAX Vault turns F3 workout history into stats worth arguing about — posts, Qs, streaks, leaderboards, FNG growth, and AO health, from the Nation all the way down to one PAX.",
};

/**
 * Resolve a human-readable environment label from runtime configuration.
 */
function getEnvironmentLabel(): "Production" | "Staging" {
  return process.env.ENVIRONMENT === "production" ? "Production" : "Staging";
}

/** Feature blocks shown in the product tour, each paired with a preview mock. */
const FEATURES: ReadonlyArray<{
  eyebrow: string;
  title: string;
  body: string;
  preview: React.ReactNode;
}> = [
  {
    eyebrow: "Leaderboards",
    title: "Settle it with numbers",
    body: "Rank the region by posts, Qs, or Q rate. Crowns call out who leads — and ties show everyone who's tied.",
    preview: <LeaderboardPreview />,
  },
  {
    eyebrow: "AO health",
    title: "See which sites are thriving",
    body: "Attendance by AO and day of week, so you can spot the site that's fading before it goes dark.",
    preview: <HeatmapPreview />,
  },
  {
    eyebrow: "Growth",
    title: "Track FNG acquisition",
    body: "Watch first-timers arrive month over month, by AO and by region — and see who keeps bringing them.",
    preview: <FngChartPreview />,
  },
  {
    eyebrow: "Milestones",
    title: "Never miss a moment",
    body: "PAX approaching their 100th post, 50th Q, or an FNG anniversary — surfaced before the day arrives, not after.",
    preview: <AchievementsPreview />,
  },
  {
    eyebrow: "Search",
    title: "Find anyone, fast",
    body: "One command-palette search across PAX, AOs, and Regions. Duplicate names are disambiguated by home region.",
    preview: <SearchPreview />,
  },
  {
    eyebrow: "Filters",
    title: "Slice it however you want",
    body: "Filter by date, AO, or event type — include or exclude — with active filters shown as chips you can pop off one at a time.",
    preview: <FiltersPreview />,
  },
];

/** F3 vocabulary the app is built around. */
const GLOSSARY: ReadonlyArray<[term: string, definition: string]> = [
  ["PAX", "A man who posts"],
  ["Post", "Showing up to a workout"],
  ["Q", "The man who leads it"],
  ["AO", "The place it happens"],
  ["FNG", "Friendly New Guy — a first-timer"],
  ["Kotter", "A PAX who's been away a while"],
  ["Bestie", "The PAX you post with most"],
  ["Region", "Your AOs, together"],
];

/** Who the dashboards were designed for. */
const PERSONAS: ReadonlyArray<{ role: string; need: string }> = [
  {
    role: "Site Qs",
    need: "Know your AO's attendance trend, your Q bench, and who's gone quiet — before it becomes a problem.",
  },
  {
    role: "Nantans & Weasel Shakers",
    need: "Compare AOs across the region, find Q-depth gaps, and see where FNG growth is actually coming from.",
  },
  {
    role: "Any PAX",
    need: "Your own record — every post, every Q, your streaks, your bestie, and the day you FNG'd.",
  },
];

export default function App() {
  const environmentLabel = getEnvironmentLabel();

  const samplePaxId = process.env.SAMPLE_PAX ?? "";
  const sampleRegionId = process.env.SAMPLE_REGION ?? "";

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-background to-default-50">
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="w-full max-w-6xl px-4 pb-14 pt-10 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          {/* Copy */}
          <div className="flex flex-col items-start gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                size="sm"
                variant="flat"
                startContent={<F3LogoIcon className="ml-1 h-3.5 w-3.5" />}
              >
                Built on F3 Nation data
              </Chip>
              <Chip
                size="sm"
                variant="flat"
                color={
                  environmentLabel === "Production" ? "success" : "warning"
                }
              >
                {environmentLabel}
              </Chip>
            </div>

            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Every post. Every Q.
              <br />
              <span className="text-primary">Every PAX.</span>
            </h1>

            <p className="max-w-xl text-base text-default-600 sm:text-lg">
              PAX Vault is the stats vault for F3 — turning your region&apos;s
              workout history into streaks, leaderboards, Q depth, FNG growth,
              and AO health. From the whole Nation down to one man&apos;s
              record, in F3 language.
            </p>

            <Suspense
              fallback={<div className="h-12 w-full sm:w-56" aria-hidden />}
            >
              <HeroActions
                samplePaxId={samplePaxId}
                sampleRegionId={sampleRegionId}
              />
            </Suspense>
          </div>

          {/* Preview stack */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-6 -z-10 rounded-[2rem] blur-2xl"
              style={{
                background:
                  "linear-gradient(to top right, color-mix(in srgb, var(--primary) 14%, transparent), color-mix(in srgb, var(--secondary) 8%, transparent), transparent)",
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <PaxCardPreview />
              <TrendChartPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Drill-down hierarchy                                             */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="tour"
        className="w-full scroll-mt-20 border-y border-default-200/60 bg-default-100/40 py-12"
      >
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Zoom all the way in
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-default-600">
              Six levels of drill-down, all connected. Start at the Nation and
              click your way down to a single PAX — or start with a name and
              walk back up. Breadcrumbs keep you oriented the whole way.
            </p>
          </div>

          <HierarchyDiagram />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Feature tour                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="w-full max-w-6xl px-4 py-14">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            What&apos;s in the vault
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-default-600">
            Not generic fitness tracking. Purpose-built dashboards for the way
            F3 actually works.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-3">
              <div className="flex-1">{feature.preview}</div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {feature.eyebrow}
                </div>
                <h3 className="mt-0.5 text-base font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-1 text-sm text-default-600">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-default-400">
          Previews above use made-up names and numbers. Real data appears once
          you sign in.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* F3 vocabulary                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="w-full border-y border-default-200/60 bg-default-100/40 py-12">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              It speaks F3
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-default-600">
              No translation layer. The labels, the counts, and the crowns use
              the words you already use in the gloom.
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GLOSSARY.map(([term, definition]) => (
              <div
                key={term}
                className="rounded-xl border border-default-200 bg-content1 px-4 py-3"
              >
                <dt className="text-sm font-semibold text-primary">{term}</dt>
                <dd className="mt-0.5 text-xs text-default-600">
                  {definition}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Who it's for                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="w-full max-w-6xl px-4 py-14">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Built for the men who run the region
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PERSONAS.map((persona) => (
            <Card key={persona.role} shadow="sm">
              <CardBody className="gap-2 p-5">
                <h3 className="text-base font-semibold">{persona.role}</h3>
                <p className="text-sm text-default-600">{persona.need}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Sign-in                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="w-full max-w-3xl px-4 pb-16">
        <Card shadow="lg">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6">
            <h2 className="text-2xl font-bold tracking-tight">
              Open the vault
            </h2>
            <p className="text-sm text-default-600">
              Sign in with your F3 Nation account. You&apos;ll land on your own
              PAX page.
            </p>
          </CardHeader>
          <Divider className="my-4" />
          <CardBody className="px-6 pb-6">
            <Suspense fallback={null}>
              <AuthCard />
            </Suspense>

            <p className="mt-4 text-center text-xs text-default-500">
              Curious what&apos;s new?{" "}
              <Link href="/changelog" className="text-primary hover:underline">
                Read the changelog
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </section>
    </main>
  );
}
