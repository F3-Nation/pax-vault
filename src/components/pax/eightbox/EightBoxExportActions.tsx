"use client";

/**
 * EightBoxExportActions
 *
 * Download PNG / Download PDF / Print for a board. Renders the fixed
 * `export` variant of the board off-screen and rasterizes THAT node, so the
 * files look the same regardless of theme or viewport (see
 * `lib/eightBoxPng.ts`).
 */

import { useRef } from "react";
import { EightBoxBoard, type EightBoxBoardProps } from "./EightBoxBoard";
import { EightBoxExportButtons } from "./EightBoxExportButtons";

type Props = Omit<EightBoxBoardProps, "variant">;

export function EightBoxExportActions(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <EightBoxExportButtons
        getNode={() =>
          hostRef.current?.querySelector<HTMLElement>(
            "[data-eightbox-export]",
          ) ?? null
        }
        f3Name={props.f3Name}
        period={props.period}
        version={props.version}
        scope="export"
      />

      {/* Off-screen host for the capture node; never shown directly. */}
      <div
        ref={hostRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: -10000,
          top: 0,
          width: 1200,
          pointerEvents: "none",
        }}
      >
        <EightBoxBoard {...props} variant="export" />
      </div>
    </>
  );
}
