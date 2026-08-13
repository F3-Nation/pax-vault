"use client";

/**
 * PreferencesForm
 *
 * Editor for a region's preferences. Rendered only for users the server has
 * already confirmed hold the admin role on the region — this component is the
 * affordance, `PUT /api/region/[regionId]/preferences` is the enforcement.
 *
 * Adding a real preference: add a control below and let it read/write the
 * matching field on `draft`. The save payload is the whole object, so nothing
 * else needs to change.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@heroui/alert";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Switch } from "@heroui/switch";
import type { RegionPreferences } from "@/lib/preferences";

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saved" }
  | { kind: "error"; message: string; errorId?: string };

type PreferencesFormProps = {
  regionId: number;
  initialPreferences: RegionPreferences;
  /** ISO timestamp of the last save; null when never saved. */
  updatedAt: string | null;
};

/** Format a BigQuery timestamp for display, tolerating unparseable values. */
function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function PreferencesForm({
  regionId,
  initialPreferences,
  updatedAt,
}: PreferencesFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<RegionPreferences>(initialPreferences);
  const [saved, setSaved] = useState<RegionPreferences>(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const lastSaved = formatUpdatedAt(updatedAt);

  async function handleSave() {
    setSaving(true);
    setStatus({ kind: "idle" });

    try {
      const res = await fetch(`/api/region/${regionId}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: draft }),
      });

      const data = (await res.json().catch(() => null)) as {
        preferences?: RegionPreferences;
        error?: string;
        errorId?: string;
      } | null;

      if (!res.ok) {
        // Show the server's message when it has one — the read-only service
        // account case in particular is actionable, and a generic
        // "Save failed" would bury it.
        setStatus({
          kind: "error",
          message: data?.error ?? `Save failed (HTTP ${res.status}).`,
          errorId: data?.errorId,
        });
        return;
      }

      const persisted = data?.preferences ?? draft;
      setDraft(persisted);
      setSaved(persisted);
      setStatus({ kind: "saved" });

      // Pull fresh server data so the region page reflects the new config.
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Save failed — could not reach the server. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraft(saved);
    setStatus({ kind: "idle" });
  }

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex flex-col items-start gap-1 px-6">
        <h2 className="text-xl font-semibold">Display Preferences</h2>
        <p className="text-sm text-foreground/60">
          {lastSaved
            ? `Last saved ${lastSaved}.`
            : "No preferences saved yet — showing defaults."}
        </p>
      </CardHeader>
      <Divider />

      <CardBody className="gap-4 px-6">
        {status.kind === "saved" && (
          <Alert color="success" title="Preferences saved" />
        )}
        {status.kind === "error" && (
          <Alert
            color="danger"
            title="Preferences not saved"
            description={
              status.errorId
                ? `${status.message} (reference: ${status.errorId})`
                : status.message
            }
          />
        )}

        <div className="flex items-start justify-between gap-6 py-1">
          <div>
            <div className="text-sm font-medium">
              Show Fart Sack King &amp; Ghost King
            </div>
            <p className="text-xs text-foreground/60">
              Off by default. When on, this region&apos;s page and all of its AO
              pages show the Fart Sack King and Ghost King stats, the Fart
              Sacker list on each workout, and muted styling for ghost posts.
              Individual PAX pages are never affected.
            </p>
          </div>
          <Switch
            isSelected={draft.showFartsackGhostStats}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, showFartsackGhostStats: value }))
            }
            aria-label="Show Fart Sack King and Ghost King"
          />
        </div>
      </CardBody>

      <Divider />
      <CardFooter className="flex items-center justify-between gap-3 px-6">
        <span className="text-xs text-foreground/50">
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="flat"
            onPress={handleReset}
            isDisabled={!isDirty || saving}
          >
            Reset
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={saving}
            isDisabled={!isDirty || saving}
          >
            Save preferences
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
