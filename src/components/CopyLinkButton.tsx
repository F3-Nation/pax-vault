"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { CopyIcon } from "@/components/icons";

/**
 * Copies an absolute URL (origin + `path`) to the clipboard and briefly shows
 * a "Copied!" confirmation. Used to share a direct link to an event (issue #77)
 * from both the event modal and the standalone event page.
 */
export function CopyLinkButton({
  path,
  label = "Copy link",
}: {
  path: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission);
      // fail silently rather than throwing in a click handler.
    }
  };

  return (
    <div className="relative inline-flex">
      <Button
        size="sm"
        variant="bordered"
        color="default"
        aria-label={label}
        startContent={<CopyIcon width={16} height={16} />}
        onPress={copy}
      >
        {copied ? "Copied!" : label}
      </Button>
    </div>
  );
}
