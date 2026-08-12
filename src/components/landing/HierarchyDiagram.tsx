/**
 * Drill-down hierarchy diagram for the landing page.
 *
 * Visualizes the six levels PAX Vault lets you navigate:
 * Nation → Sector → Area → Region → AO → PAX.
 *
 * Presentational only — a vertical stack on small screens, a horizontal chain
 * from `md` up. The connector chevron rotates to match the axis.
 */
import { Fragment } from "react";

const LEVELS: ReadonlyArray<{ name: string; blurb: string }> = [
  { name: "Nation", blurb: "All regions" },
  { name: "Sector", blurb: "Area rollups" },
  { name: "Area", blurb: "Region groups" },
  { name: "Region", blurb: "Leaders & AOs" },
  { name: "AO", blurb: "Site trends" },
  { name: "PAX", blurb: "One man's record" },
];

export function HierarchyDiagram() {
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row">
      {LEVELS.map((level, i) => (
        <Fragment key={level.name}>
          <div className="flex-1 rounded-xl border border-default-200 bg-content1 px-3 py-2.5 text-center shadow-sm">
            <div className="text-sm font-semibold">{level.name}</div>
            <div className="mt-0.5 text-[11px] leading-tight text-default-500">
              {level.blurb}
            </div>
          </div>

          {i < LEVELS.length - 1 && (
            <div className="flex shrink-0 items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4 rotate-90 text-primary md:rotate-0"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
