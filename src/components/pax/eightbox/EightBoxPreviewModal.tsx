"use client";

/**
 * EightBoxPreviewModal
 *
 * Shows the editor's current, unsaved board exactly as the PNG / PDF / print
 * will render it: the same fixed-width `export` node, scaled down to fit the
 * modal. What you see is what you get — the export buttons rasterize this
 * very node, so overflow, wrapping, and truncation problems show up here
 * before anything is published.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import type { EightBoxContent } from "@/lib/eightBox";
import { EightBoxBoard } from "./EightBoxBoard";
import { EightBoxExportButtons } from "./EightBoxExportButtons";

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
            Exactly what the PNG, the PDF, and the printout will look like,
            scaled to fit. Nothing is saved from here.
          </span>
        </ModalHeader>
        <ModalBody className="gap-3">
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
        <ModalFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="flat"
            className="self-start"
            onPress={() => onOpenChange(false)}
          >
            Close
          </Button>
          <EightBoxExportButtons
            getNode={() =>
              boardHostRef.current?.querySelector<HTMLElement>(
                "[data-eightbox-export]",
              ) ?? null
            }
            f3Name={f3Name}
            period={period}
            version={version}
            size="md"
            scope="preview"
          />
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
