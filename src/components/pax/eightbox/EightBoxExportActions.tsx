"use client";

/**
 * EightBoxExportActions
 *
 * "Download PNG" and "Print / Save as PDF" for a board. Renders the fixed
 * `export` variant of the board off-screen and captures THAT node, so the
 * file looks the same regardless of theme or viewport.
 *
 * Both buttons go through the same rasterization: print sends the PNG to a
 * hidden iframe and opens the print dialog there, so the printout matches
 * the download exactly (see `lib/eightBoxPng.ts`).
 */

import { useRef, useState } from "react";
import { Alert } from "@heroui/alert";
import { Button } from "@heroui/button";
import { reportError } from "@/lib/observability";
import {
  downloadEightBoxPng,
  eightBoxPngFilename,
  printEightBoxNode,
} from "@/lib/eightBoxPng";
import { EightBoxBoard, type EightBoxBoardProps } from "./EightBoxBoard";

type Props = Omit<EightBoxBoardProps, "variant">;

export function EightBoxExportActions(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<null | "download" | "print">(null);
  const [error, setError] = useState<{
    message: string;
    errorId: string;
  } | null>(null);

  async function handleDownload() {
    const node = hostRef.current?.querySelector<HTMLElement>(
      "[data-eightbox-export]",
    );
    if (!node) return;

    setBusy("download");
    setError(null);
    try {
      await downloadEightBoxPng(
        node,
        eightBoxPngFilename(props.f3Name, props.period, props.version),
        `${props.f3Name} — 8 Box`,
      );
    } catch (err) {
      const errorId = reportError(err, { scope: "client/eightbox-export" });
      setError({ message: "Could not create the image.", errorId });
    } finally {
      setBusy(null);
    }
  }

  async function handlePrint() {
    const node = hostRef.current?.querySelector<HTMLElement>(
      "[data-eightbox-export]",
    );
    if (!node) return;

    setBusy("print");
    setError(null);
    try {
      await printEightBoxNode(node, `${props.f3Name} — 8 Box`);
    } catch (err) {
      const errorId = reportError(err, { scope: "client/eightbox-print" });
      setError({
        message: "Could not open the print dialog. Download the PNG instead.",
        errorId,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          color="primary"
          variant="flat"
          onPress={handleDownload}
          isLoading={busy === "download"}
          isDisabled={busy !== null}
        >
          Download PNG
        </Button>
        <Button
          size="sm"
          variant="bordered"
          onPress={handlePrint}
          isLoading={busy === "print"}
          isDisabled={busy !== null}
        >
          Print / Save as PDF
        </Button>
      </div>
      {error && (
        <Alert
          color="danger"
          title="Export failed"
          description={`${error.message} (reference: ${error.errorId})`}
        />
      )}

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
    </div>
  );
}
