"use client";

/**
 * EightBoxShareToggle
 *
 * Turns the share link for one PUBLISHED version on or off, and exposes the
 * link while it is on. Rendered only for the owner; `PATCH` re-checks.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@heroui/alert";
import { Switch } from "@heroui/switch";
import { CopyLinkButton } from "@/components/CopyLinkButton";

type Props = {
  paxId: number;
  versionId: string;
  sharedAt: string | null;
};

export function EightBoxShareToggle({ paxId, versionId, sharedAt }: Props) {
  const router = useRouter();
  const [shared, setShared] = useState(sharedAt !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    message: string;
    errorId?: string;
  } | null>(null);

  const path = `/stats/pax/${paxId}/8box/${versionId}`;

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pax/${paxId}/8box/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared: next }),
      });
      const data = (await res.json().catch(() => null)) as {
        shared?: boolean;
        error?: string;
        errorId?: string;
      } | null;

      if (!res.ok) {
        setError({
          message: data?.error ?? `Update failed (HTTP ${res.status}).`,
          errorId: data?.errorId,
        });
        return;
      }

      setShared(data?.shared ?? next);
      router.refresh();
    } catch {
      setError({
        message: "Could not reach the server. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 md:items-end md:text-right">
      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        <Switch
          size="sm"
          isSelected={shared}
          isDisabled={busy}
          onValueChange={toggle}
          aria-label="Share this version by link"
        >
          Share link
        </Switch>
        {shared && <CopyLinkButton path={path} />}
      </div>
      <p className="text-xs text-foreground/60">
        {shared
          ? "Anyone signed in to PAX Vault with this link can view this version. Turn it off to revoke."
          : "Off. Only you can see this version."}
      </p>
      {error && (
        <Alert
          color="danger"
          title="Sharing not updated"
          description={
            error.errorId
              ? `${error.message} (reference: ${error.errorId})`
              : error.message
          }
        />
      )}
    </div>
  );
}
