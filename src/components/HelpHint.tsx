"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HelpIcon } from "@/components/icons";
import { Tooltip } from "@heroui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";

/**
 * Small "?" help affordance next to a label. Uses a hover Tooltip on desktop
 * and a tap Popover on mobile (hover is unreliable on touch). Replaces the
 * isMobile + Popover/Tooltip block that was copy-pasted into several cards.
 */
export function HelpHint({ content }: { content: ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  if (isMobile) {
    return (
      <Popover placement="bottom-start">
        <PopoverTrigger>
          <span className="inline-flex cursor-pointer items-center">
            <HelpIcon className="inline-block ml-1 text-default" />
          </span>
        </PopoverTrigger>
        <PopoverContent className="max-w-[260px] p-2 text-sm">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip content={content}>
      <span className="inline-flex cursor-help items-center">
        <HelpIcon className="inline-block ml-1 text-default" />
      </span>
    </Tooltip>
  );
}
