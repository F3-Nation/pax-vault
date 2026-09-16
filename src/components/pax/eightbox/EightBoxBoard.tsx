/**
 * EightBoxBoard
 *
 * The 2×4 grid of boxes with the "Word for the Box" in the middle, rendered
 * two ways from one set of props:
 *
 * - `screen`: HeroUI cards with theme tokens, responsive, used on the pages.
 * - `export`: a fixed 1200px board with INLINE HEX STYLES ONLY. This is the
 *   node captured for the PNG download and shown by the print stylesheet, so
 *   it must look identical in light and dark mode and must not depend on any
 *   CSS variable or class the capture library would have to resolve. No
 *   <img> either — a cross-origin avatar would taint the canvas.
 *
 * Both variants render generically from `EIGHT_BOX_DEFINITIONS`: list items
 * first, then each non-empty sub-field as "Label: value". Empty fields are
 * simply omitted.
 *
 * No "use client": server pages render the screen variant directly, and the
 * client export wrapper renders the export variant off-screen.
 */

import type { CSSProperties, ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import {
  EIGHT_BOX_DEFINITIONS,
  isBoxBlank,
  type EightBoxContent,
  type EightBoxDefinition,
  type EightBoxItem,
  type EightBoxValues,
} from "@/lib/eightBox";

export type EightBoxBoardProps = {
  content: EightBoxContent;
  period: string;
  f3Name: string;
  version?: number | null;
  publishedAt?: string | null;
  variant: "screen" | "export";
};

/**
 * "Sep 16, 2026" for an ISO timestamp, or null when unparseable. Pinned to
 * UTC and en-US so server and client render the same string (no hydration
 * drift across time zones).
 */
export function formatEightBoxDate(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Subtitle line shared by both variants: "2026-Q3 · v2 · Sep 16, 2026". */
export function eightBoxMetaLine(
  period: string,
  version?: number | null,
  publishedAt?: string | null,
): string {
  const parts = [period];
  if (version != null) parts.push(`v${version}`);
  const date = formatEightBoxDate(publishedAt);
  if (date) parts.push(date);
  return parts.join(" · ");
}

/**
 * One list item as a single line: the first item field is the lead, the
 * rest follow as "Label value" fragments. "1,000 miles · Target 1,000 mi ·
 * So far 340".
 */
function itemLine(def: EightBoxDefinition, item: EightBoxItem): string {
  const fields = def.list!.itemFields;
  const [lead, ...rest] = fields;
  const parts: string[] = [];
  if (item[lead.key]) parts.push(item[lead.key]);
  for (const f of rest) {
    if (item[f.key]) parts.push(`${f.label}: ${item[f.key]}`);
  }
  return parts.join(" · ");
}

/** The renderable lines of one box, in display order. */
function boxLines(
  def: EightBoxDefinition,
  values: EightBoxValues,
): { label: string | null; text: string; kind: "item" | "field" }[] {
  const lines: {
    label: string | null;
    text: string;
    kind: "item" | "field";
  }[] = [];
  if (def.list) {
    for (const item of values.items) {
      const text = itemLine(def, item);
      if (text) lines.push({ label: null, text, kind: "item" });
    }
  }
  for (const field of def.fields) {
    const text = values.fields[field.key];
    if (text) lines.push({ label: field.label, text, kind: "field" });
  }
  return lines;
}

// ── export palette (hex only; see file header) ─────────────────────────────
const EXPORT_WIDTH = 1200;
const C = {
  bg: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  accent: "#006fee",
  boxBg: "#f9fafb",
};

const ex: Record<string, CSSProperties> = {
  root: {
    width: EXPORT_WIDTH,
    boxSizing: "border-box",
    padding: 40,
    background: C.bg,
    color: C.text,
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    lineHeight: 1.4,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `2px solid ${C.text}`,
  },
  name: { fontSize: 32, fontWeight: 700, margin: 0 },
  meta: { fontSize: 16, color: C.muted, margin: 0, textAlign: "right" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
  },
  box: {
    boxSizing: "border-box",
    minHeight: 220,
    padding: 16,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    background: C.boxBg,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  boxTitle: { fontSize: 16, fontWeight: 700, color: C.accent, margin: 0 },
  boxSubtitle: { fontSize: 11, color: C.muted, margin: "0 0 4px 0" },
  line: {
    fontSize: 13,
    margin: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  lineLabel: { fontWeight: 600, color: C.muted, fontSize: 11 },
  item: {
    fontSize: 13,
    margin: 0,
    paddingLeft: 12,
    textIndent: -12,
    overflowWrap: "anywhere",
  },
  boxEmpty: { fontSize: 13, margin: 0, color: C.muted, fontStyle: "italic" },
  wordBand: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: "14px 16px",
    border: `2px solid ${C.text}`,
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  wordCaption: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: C.muted,
    margin: 0,
  },
  word: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
    margin: 0,
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTop: `1px solid ${C.border}`,
    fontSize: 12,
    color: C.muted,
    display: "flex",
    justifyContent: "space-between",
  },
};

function ExportBox({
  def,
  values,
}: {
  def: EightBoxDefinition;
  values: EightBoxValues;
}) {
  const lines = boxLines(def, values);
  return (
    <div style={ex.box}>
      <h2 style={ex.boxTitle}>{def.title}</h2>
      <p style={ex.boxSubtitle}>{def.subtitle}</p>
      {lines.length === 0 ? (
        <p style={ex.boxEmpty}>—</p>
      ) : (
        lines.map((line, i) =>
          line.kind === "item" ? (
            <p key={i} style={ex.item}>
              • {line.text}
            </p>
          ) : (
            <p key={i} style={ex.line}>
              <span style={ex.lineLabel}>{line.label}: </span>
              {line.text}
            </p>
          ),
        )
      )}
    </div>
  );
}

function ExportBoard({
  content,
  period,
  f3Name,
  version,
  publishedAt,
}: Omit<EightBoxBoardProps, "variant">) {
  const top = EIGHT_BOX_DEFINITIONS.slice(0, 4);
  const bottom = EIGHT_BOX_DEFINITIONS.slice(4);
  return (
    <div data-eightbox-export="" style={ex.root}>
      <div style={ex.header}>
        <h1 style={ex.name}>{f3Name}</h1>
        <p style={ex.meta}>
          8 Box · {eightBoxMetaLine(period, version, publishedAt)}
        </p>
      </div>
      <div style={ex.grid}>
        {top.map((def) => (
          <ExportBox key={def.key} def={def} values={content.boxes[def.key]} />
        ))}
        <div style={ex.wordBand}>
          <p style={ex.wordCaption}>Word for the Box</p>
          <p style={ex.word}>{content.word || "—"}</p>
        </div>
        {bottom.map((def) => (
          <ExportBox key={def.key} def={def} values={content.boxes[def.key]} />
        ))}
      </div>
      <div style={ex.footer}>
        <span>F3 8 Box · Concentrica · 1st/2nd/3rd F · Jester · ALR</span>
        <span>PAX Vault</span>
      </div>
    </div>
  );
}

function ScreenBox({
  def,
  values,
}: {
  def: EightBoxDefinition;
  values: EightBoxValues;
}) {
  const lines = boxLines(def, values);
  let body: ReactNode;
  if (isBoxBlank(values) || lines.length === 0) {
    body = <span className="italic text-foreground/40">Nothing here yet.</span>;
  } else {
    body = (
      <ul className="flex flex-col gap-1.5">
        {lines.map((line, i) =>
          line.kind === "item" ? (
            <li key={i} className="pl-3 -indent-3 break-words">
              • {line.text}
            </li>
          ) : (
            <li key={i} className="whitespace-pre-wrap break-words">
              <span className="text-xs font-semibold text-foreground/50">
                {line.label}:{" "}
              </span>
              {line.text}
            </li>
          ),
        )}
      </ul>
    );
  }
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex flex-col items-start gap-0.5 px-4 pb-1">
        <h3 className="text-sm font-semibold text-primary">{def.title}</h3>
        <p className="text-xs text-foreground/50">{def.subtitle}</p>
      </CardHeader>
      <CardBody className="px-4 pt-1 text-sm">{body}</CardBody>
    </Card>
  );
}

function ScreenBoard({ content }: Pick<EightBoxBoardProps, "content">) {
  const top = EIGHT_BOX_DEFINITIONS.slice(0, 4);
  const bottom = EIGHT_BOX_DEFINITIONS.slice(4);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {top.map((def) => (
        <ScreenBox key={def.key} def={def} values={content.boxes[def.key]} />
      ))}
      <div className="col-span-full flex flex-col items-center gap-0.5 rounded-xl border-2 border-foreground/80 px-4 py-3 text-center">
        <span className="text-[11px] uppercase tracking-[0.2em] text-foreground/50">
          Word for the Box
        </span>
        <span className="text-3xl font-extrabold uppercase tracking-wide">
          {content.word || (
            <span className="text-base font-normal normal-case italic tracking-normal text-foreground/40">
              No word yet.
            </span>
          )}
        </span>
      </div>
      {bottom.map((def) => (
        <ScreenBox key={def.key} def={def} values={content.boxes[def.key]} />
      ))}
    </div>
  );
}

export function EightBoxBoard(props: EightBoxBoardProps) {
  return props.variant === "export" ? (
    <ExportBoard {...props} />
  ) : (
    <ScreenBoard content={props.content} />
  );
}
