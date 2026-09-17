"use client";

/**
 * EightBoxExportButtons
 *
 * The three export actions — Download PNG, Download PDF, Print — for one
 * export board node, with a shared busy state and error banner. Used by the
 * version/overview pages (off-screen node) and the Preview modal (visible
 * node); the caller supplies a getter for the node.
 */

import { useState, type ReactNode } from "react";
import { Alert } from "@heroui/alert";
import { Button } from "@heroui/button";
import { reportError } from "@/lib/observability";
import {
  downloadEightBoxPdf,
  downloadEightBoxPng,
  eightBoxExportFilename,
  printEightBoxNode,
} from "@/lib/eightBoxPng";

type Action = "png" | "pdf" | "print";

type Props = {
  /** Returns the `[data-eightbox-export]` node to rasterize, or null. */
  getNode: () => HTMLElement | null;
  f3Name: string;
  period: string;
  version?: number | null;
  size?: "sm" | "md";
  /** Where the error banner renders; defaults to under the buttons. */
  renderError?: (banner: ReactNode) => ReactNode;
  /** Reporting scope suffix, e.g. "export" or "preview". */
  scope: string;
};

export function EightBoxExportButtons({
  getNode,
  f3Name,
  period,
  version,
  size = "sm",
  scope,
}: Props) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<{
    message: string;
    errorId: string;
  } | null>(null);

  const title = `${f3Name} — 8 Box`;

  async function run(action: Action) {
    const node = getNode();
    if (!node) return;
    setBusy(action);
    setError(null);
    try {
      if (action === "png") {
        await downloadEightBoxPng(
          node,
          eightBoxExportFilename(f3Name, period, version, "png"),
          title,
        );
      } else if (action === "pdf") {
        await downloadEightBoxPdf(
          node,
          eightBoxExportFilename(f3Name, period, version, "pdf"),
          title,
        );
      } else {
        await printEightBoxNode(node, title);
      }
    } catch (err) {
      const errorId = reportError(err, {
        scope: `client/eightbox-${scope}:${action}`,
      });
      setError({
        message:
          action === "print"
            ? "Could not open the print dialog."
            : `Could not create the ${action.toUpperCase()}.`,
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
          size={size}
          color="primary"
          variant="flat"
          onPress={() => run("png")}
          isLoading={busy === "png"}
          isDisabled={busy !== null}
        >
          Download PNG
        </Button>
        <Button
          size={size}
          color="primary"
          variant="flat"
          onPress={() => run("pdf")}
          isLoading={busy === "pdf"}
          isDisabled={busy !== null}
        >
          Download PDF
        </Button>
        <Button
          size={size}
          variant="bordered"
          onPress={() => run("print")}
          isLoading={busy === "print"}
          isDisabled={busy !== null}
        >
          Print
        </Button>
      </div>
      {error && (
        <Alert
          color="danger"
          title="Export failed"
          description={`${error.message} (reference: ${error.errorId})`}
        />
      )}
    </div>
  );
}
