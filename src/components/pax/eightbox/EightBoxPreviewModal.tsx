"use client";

/**
 * EightBoxPreviewModal
 *
 * Shows the editor's current, unsaved board exactly as the PNG / print will
 * render it: the same fixed-width `export` node, scaled down to fit the
 * modal. What you see is what you get — the Download button captures this
 * very node, so overflow, wrapping, and truncation problems show up here
 * before anything is published.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { Alert } from "@heroui/alert";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { reportError } from "@/lib/observability";
import {
  downloadEightBoxPng,
  eightBoxPngFilename,
  printEightBoxNode,
} from "@/lib/eightBoxPng";
import type { EightBoxContent } from "@/lib/eightBox";
import { EightBoxBoard } from "./EightBoxBoard";

const EXPORT_WIDTH = 1200;

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  content: EightBoxContent;
  period: string;
  f3Name: string;
  /** Shown in the board's header when known (e.g. "v3 will be…"). */
  version?: number | null;
};

export function EightBoxPreviewModal({
  isOpen,
  onOpenChange,
  content,
  period,
  f3Name,
  version,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const boardHostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [boardHeight, setBoardHeight] = useState(0);
  const [busy, setBusy] = useState<null | "download" | "print">(null);
  const [error, setError] = useState<{
    message: string;
    errorId: string;
  } | null>(null);

  // Fit the 1200px board to the modal's width and reserve the scaled height,
  // re-measuring whenever the modal or the board's content changes size.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const frame = frameRef.current;
    const host = boardHostRef.current;
    if (!frame || !host) return;

    const measure = () => {
      const width = frame.clientWidth;
      const node = host.querySelector<HTMLElement>("[data-eightbox-export]");
      const height = node?.offsetHeight ?? 0;
      const next = width > 0 ? Math.min(1, width / EXPORT_WIDTH) : 1;
      setScale(next);
      setBoardHeight(height);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(host);
    return () => observer.disconnect();
  }, [isOpen, content, period]);

  async function handleDownload() {
    const node = boardHostRef.current?.querySelector<HTMLElement>(
      "[data-eightbox-export]",
    );
    if (!node) return;
    setBusy("download");
    setError(null);
    try {
      await downloadEightBoxPng(
        node,
        eightBoxPngFilename(f3Name, period, version),
        `${f3Name} — 8 Box`,
      );
    } catch (err) {
      const errorId = reportError(err, { scope: "client/eightbox-preview" });
      setError({ message: "Could not create the image.", errorId });
    } finally {
      setBusy(null);
    }
  }

  async function handlePrint() {
    const node = boardHostRef.current?.querySelector<HTMLElement>(
      "[data-eightbox-export]",
    );
    if (!node) return;
    setBusy("print");
    setError(null);
    try {
      await printEightBoxNode(node, `${f3Name} — 8 Box`);
    } catch (err) {
      const errorId = reportError(err, { scope: "client/eightbox-preview" });
      setError({ message: "Could not open the print dialog.", errorId });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="5xl"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>Preview</span>
          <span className="text-sm font-normal text-foreground/60">
            Exactly what the PNG and the printout will look like, scaled to fit.
            Nothing is saved from here.
          </span>
        </ModalHeader>
        <ModalBody className="gap-3">
          {error && (
            <Alert
              color="danger"
              title="Export failed"
              description={`${error.message} (reference: ${error.errorId})`}
            />
          )}
          <div
            ref={frameRef}
            className="w-full overflow-hidden rounded-lg border border-default-200 bg-white"
            style={{ height: boardHeight ? boardHeight * scale : undefined }}
          >
            <div
              ref={boardHostRef}
              style={{
                width: EXPORT_WIDTH,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <EightBoxBoard
                variant="export"
                content={content}
                period={period}
                f3Name={f3Name}
                version={version}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="bordered"
            onPress={handlePrint}
            isLoading={busy === "print"}
            isDisabled={busy !== null}
          >
            Print / Save as PDF
          </Button>
          <Button
            color="primary"
            variant="flat"
            onPress={handleDownload}
            isLoading={busy === "download"}
            isDisabled={busy !== null}
          >
            Download PNG
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
