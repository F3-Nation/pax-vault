"use client";

/**
 * EightBoxExportActions
 *
 * "Download PNG" and "Print / Save as PDF" for a board. Renders the fixed
 * `export` variant of the board off-screen and captures THAT node, so the
 * file looks the same regardless of theme or viewport.
 *
 * Printing relies on the `@media print` rules in globals.css, which hide
 * everything but the export node.
 */

import { useRef, useState } from "react";
import { Alert } from "@heroui/alert";
import { Button } from "@heroui/button";
import { reportError } from "@/lib/observability";
import { downloadEightBoxPng, eightBoxPngFilename } from "@/lib/eightBoxPng";
import { EightBoxBoard, type EightBoxBoardProps } from "./EightBoxBoard";

type Props = Omit<EightBoxBoardProps, "variant">;

export function EightBoxExportActions(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    message: string;
    errorId: string;
  } | null>(null);

  async function handleDownload() {
    const node = hostRef.current?.querySelector<HTMLElement>(
      "[data-eightbox-export]",
    );
    if (!node) return;

    setBusy(true);
    setError(null);
    try {
      await downloadEightBoxPng(
        node,
        eightBoxPngFilename(props.f3Name, props.period, props.version),
        `${props.f3Name} — 8 Box`,
      );
    } catch (err) {
      const errorId = reportError(err, { scope: "client/eightbox-export" });
      setError({
        message: "Could not create the image. Try Print / Save as PDF instead.",
        errorId,
      });
    } finally {
      setBusy(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          color="primary"
          variant="flat"
          onPress={handleDownload}
          isLoading={busy}
          isDisabled={busy}
        >
          Download PNG
        </Button>
        <Button size="sm" variant="bordered" onPress={handlePrint}>
          Print / Save as PDF
        </Button>
      </div>
      {error && (
        <Alert
          color="danger"
          title="Download failed"
          description={`${error.message} (reference: ${error.errorId})`}
        />
      )}

      {/*
        Off-screen host for the capture/print node. `data-eightbox-print-host`
        lets the print stylesheet bring it back into flow; the board inside
        is what gets captured and printed.
      */}
      <div
        ref={hostRef}
        data-eightbox-print-host=""
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
    </div>
  );
}
