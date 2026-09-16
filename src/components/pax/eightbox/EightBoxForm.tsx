"use client";

/**
 * EightBoxForm
 *
 * The draft editor. Three actions:
 *   - Save draft   → PUT  /api/pax/[paxId]/8box/draft   (stay here)
 *   - Publish      → POST /api/pax/[paxId]/8box/publish (go to the version)
 *   - Discard      → DELETE the draft row               (back to /8box)
 *
 * Every control is generated from `EIGHT_BOX_DEFINITIONS`: one card per box
 * with its guidance, its list (goals / men / jesters) if it has one, and its
 * scalar sub-fields. Rendered only for the owner (the page gates for UX);
 * every route re-checks. State model follows `region/PreferencesForm`.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@heroui/alert";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Input, Textarea } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { useDisclosure } from "@heroui/use-disclosure";
import {
  EIGHT_BOX_DEFINITIONS,
  EIGHT_BOX_PERIOD_HELP,
  EIGHT_BOX_PERIOD_MAX_CHARS,
  EIGHT_BOX_WORD_HELP,
  EIGHT_BOX_WORD_MAX,
  emptyItem,
  fieldMax,
  isEightBoxBlank,
  type EightBoxContent,
  type EightBoxDefinition,
  type EightBoxFieldSpec,
  type EightBoxItem,
  type EightBoxKey,
} from "@/lib/eightBox";
import { HelpHint } from "@/components/HelpHint";
import { EightBoxDeleteButton } from "./EightBoxDeleteButton";
import { EightBoxPreviewModal } from "./EightBoxPreviewModal";

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string; errorId?: string };

type Props = {
  paxId: number;
  /** Existing draft row id, or null when this is a fresh start. */
  draftId: string | null;
  initialContent: EightBoxContent;
  initialPeriod: string;
  /** What "Publish" will produce, for the confirm dialog. */
  nextVersion: number;
  /** ISO timestamp of the draft's last save, when one exists. */
  draftUpdatedAt: string | null;
  /** True when the initial content came from a published version, not a draft. */
  prefilledFromPublished: boolean;
  /** Owner's F3 name, for the preview board header. */
  f3Name: string;
};

function formatTime(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

/**
 * Pad each list to its minimum row count so the editor always shows blank
 * slots to fill (blank rows are dropped again on save).
 */
function withEditorRows(content: EightBoxContent): EightBoxContent {
  const boxes = { ...content.boxes };
  for (const def of EIGHT_BOX_DEFINITIONS) {
    if (!def.list) continue;
    const items = [...boxes[def.key].items];
    while (items.length < def.list.rows) items.push(emptyItem(def.list));
    boxes[def.key] = { ...boxes[def.key], items };
  }
  return { ...content, boxes };
}

/**
 * A control label with the info icon. The icon lives inside the <label>, so
 * the wrapper swallows the click: otherwise tapping "?" on a phone would also
 * activate the label and focus the input underneath the popover.
 */
function labelWithHelp(label: string, help?: string) {
  if (!help) return label;
  return (
    <span className="inline-flex items-center gap-0.5">
      {label}
      <span onClick={(e) => e.preventDefault()}>
        <HelpHint
          content={<div className="max-w-[280px] text-sm">{help}</div>}
        />
      </span>
    </span>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  compact,
}: {
  field: EightBoxFieldSpec;
  value: string;
  onChange: (value: string) => void;
  /** Tighter layout for list-item fields. */
  compact?: boolean;
}) {
  const max = fieldMax(field);
  if (field.kind === "short") {
    return (
      <Input
        label={labelWithHelp(field.label, field.help)}
        placeholder={field.prompt}
        value={value}
        onValueChange={onChange}
        maxLength={max}
        variant="bordered"
        size={compact ? "sm" : "md"}
      />
    );
  }
  return (
    <Textarea
      label={labelWithHelp(field.label, field.help)}
      placeholder={field.prompt}
      value={value}
      onValueChange={onChange}
      maxLength={max}
      minRows={compact ? 2 : 3}
      description={
        value.length > max * 0.75 ? `${value.length}/${max}` : undefined
      }
      variant="bordered"
      size={compact ? "sm" : "md"}
    />
  );
}

export function EightBoxForm({
  paxId,
  draftId: initialDraftId,
  initialContent,
  initialPeriod,
  nextVersion,
  draftUpdatedAt,
  prefilledFromPublished,
  f3Name,
}: Props) {
  const router = useRouter();
  const publishModal = useDisclosure();
  const previewModal = useDisclosure();

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [period, setPeriod] = useState(initialPeriod);
  const [content, setContent] = useState<EightBoxContent>(() =>
    withEditorRows(initialContent),
  );
  // A fresh start or a prefill from a published version has nothing saved
  // yet, so it starts dirty; an existing draft starts clean.
  const [saved, setSaved] = useState<string | null>(() =>
    initialDraftId
      ? JSON.stringify({
          period: initialPeriod,
          content: withEditorRows(initialContent),
        })
      : null,
  );
  const [busy, setBusy] = useState<null | "draft" | "publish">(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const snapshot = useMemo(
    () => JSON.stringify({ period, content }),
    [period, content],
  );
  const isDirty = saved === null || snapshot !== saved;
  const isBlank = isEightBoxBlank(content);
  const periodValid =
    period.trim().length > 0 &&
    period.trim().length <= EIGHT_BOX_PERIOD_MAX_CHARS;

  // Warn before leaving with unsaved edits (browser-native dialog).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── state helpers ────────────────────────────────────────────────────────
  function setField(box: EightBoxKey, key: string, value: string) {
    setContent((prev) => ({
      ...prev,
      boxes: {
        ...prev.boxes,
        [box]: {
          ...prev.boxes[box],
          fields: { ...prev.boxes[box].fields, [key]: value },
        },
      },
    }));
  }

  function setItems(
    box: EightBoxKey,
    update: (items: EightBoxItem[]) => EightBoxItem[],
  ) {
    setContent((prev) => ({
      ...prev,
      boxes: {
        ...prev.boxes,
        [box]: { ...prev.boxes[box], items: update(prev.boxes[box].items) },
      },
    }));
  }

  function setItemField(
    box: EightBoxKey,
    index: number,
    key: string,
    value: string,
  ) {
    setItems(box, (items) =>
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  // ── requests ─────────────────────────────────────────────────────────────
  function readError(
    res: Response,
    data: { error?: string; errorId?: string } | null,
    fallback: string,
  ): SaveStatus {
    return {
      kind: "error",
      message: data?.error ?? `${fallback} (HTTP ${res.status}).`,
      errorId: data?.errorId,
    };
  }

  const payload = () =>
    JSON.stringify({ period, word: content.word, boxes: content.boxes });

  async function handleSaveDraft() {
    setBusy("draft");
    setStatus({ kind: "idle" });
    try {
      const res = await fetch(`/api/pax/${paxId}/8box/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload(),
      });
      const data = (await res.json().catch(() => null)) as {
        id?: string;
        error?: string;
        errorId?: string;
      } | null;

      if (!res.ok) {
        setStatus(readError(res, data, "Save failed"));
        return;
      }

      if (data?.id) setDraftId(data.id);
      setSaved(snapshot);
      setStatus({ kind: "saved", at: new Date() });
    } catch {
      setStatus({
        kind: "error",
        message: "Save failed — could not reach the server. Please try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handlePublish() {
    setBusy("publish");
    setStatus({ kind: "idle" });
    try {
      const res = await fetch(`/api/pax/${paxId}/8box/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload(),
      });
      const data = (await res.json().catch(() => null)) as {
        id?: string;
        error?: string;
        errorId?: string;
      } | null;

      if (!res.ok || !data?.id) {
        publishModal.onClose();
        setStatus(readError(res, data, "Publish failed"));
        return;
      }

      // Nothing is dirty any more: the draft just became a version.
      setSaved(snapshot);
      router.push(`/stats/pax/${paxId}/8box/${data.id}`);
    } catch {
      publishModal.onClose();
      setStatus({
        kind: "error",
        message:
          "Publish failed — could not reach the server. Please try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  const lastSaved =
    status.kind === "saved"
      ? formatTime(status.at)
      : draftId
        ? formatTime(draftUpdatedAt)
        : null;

  // ── rendering ────────────────────────────────────────────────────────────
  function renderList(def: EightBoxDefinition) {
    const list = def.list;
    if (!list) return null;
    const items = content.boxes[def.key].items;
    const canAdd = !list.fixed && items.length < list.max;
    const canRemove = !list.fixed && items.length > list.rows;
    return (
      <div className="flex flex-col gap-3">
        <div className="text-sm font-medium">{list.label}</div>
        {items.map((item, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-lg border border-default-200 p-3 sm:flex-row sm:items-start"
          >
            <span className="shrink-0 pt-2 text-xs font-semibold text-foreground/50 sm:w-6">
              {index + 1}.
            </span>
            <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
              {list.itemFields.map((field) => (
                <div
                  key={field.key}
                  className={
                    field.kind === "text" ? "sm:col-span-full" : undefined
                  }
                >
                  <FieldControl
                    field={field}
                    value={item[field.key] ?? ""}
                    onChange={(v) => setItemField(def.key, index, field.key, v)}
                    compact
                  />
                </div>
              ))}
            </div>
            {canRemove && (
              <Button
                size="sm"
                variant="light"
                color="danger"
                className="shrink-0 self-end sm:self-start"
                onPress={() =>
                  setItems(def.key, (prev) =>
                    prev.filter((_, i) => i !== index),
                  )
                }
                aria-label={`Remove ${list.label.toLowerCase()} ${index + 1}`}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        {canAdd && (
          <Button
            size="sm"
            variant="flat"
            className="self-start"
            onPress={() =>
              setItems(def.key, (prev) => [...prev, emptyItem(list)])
            }
          >
            {list.addLabel ?? "Add"}
          </Button>
        )}
      </div>
    );
  }

  function renderBox(def: EightBoxDefinition) {
    const values = content.boxes[def.key];
    return (
      <Card
        key={def.key}
        className="bg-background/60 dark:bg-default-100/50"
        shadow="md"
      >
        <CardHeader className="flex flex-col items-start gap-1 px-6">
          <h3 className="text-lg font-semibold text-primary">{def.title}</h3>
          <p className="text-sm text-foreground/70">{def.subtitle}</p>
          <p className="text-xs text-foreground/50">{def.guidance}</p>
        </CardHeader>
        <Divider />
        <CardBody className="gap-4 px-6">
          {renderList(def)}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {def.fields.map((field) => (
              <div
                key={field.key}
                className={field.key === "notes" ? "md:col-span-2" : undefined}
              >
                <FieldControl
                  field={field}
                  value={values.fields[field.key] ?? ""}
                  onChange={(v) => setField(def.key, field.key, v)}
                />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  const statusBanner = (
    <>
      {status.kind === "saved" && <Alert color="success" title="Draft saved" />}
      {status.kind === "error" && (
        <Alert
          color="danger"
          title="Not saved"
          description={
            status.errorId
              ? `${status.message} (reference: ${status.errorId})`
              : status.message
          }
        />
      )}
    </>
  );

  const actions = (
    <div className="flex flex-wrap justify-end gap-2">
      {draftId && (
        <EightBoxDeleteButton
          paxId={paxId}
          versionId={draftId}
          label="draft"
          kind="draft"
          redirectTo={`/stats/pax/${paxId}/8box`}
          variant="light"
          size="md"
        />
      )}
      <Button
        variant="bordered"
        onPress={previewModal.onOpen}
        isDisabled={busy !== null}
      >
        Preview
      </Button>
      <Button
        variant="flat"
        onPress={handleSaveDraft}
        isLoading={busy === "draft"}
        isDisabled={busy !== null || !isDirty || !periodValid}
      >
        Save draft
      </Button>
      <Button
        color="primary"
        onPress={publishModal.onOpen}
        isDisabled={busy !== null || isBlank || !periodValid}
      >
        Publish
      </Button>
    </div>
  );

  return (
    <>
      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
        <CardHeader className="flex flex-col items-start gap-1 px-6">
          <h2 className="text-xl font-semibold">
            {draftId ? "Your draft" : "New 8 Box"}
          </h2>
          <p className="text-sm text-foreground/60">
            {draftId
              ? lastSaved
                ? `Draft last saved ${lastSaved}. Nobody else can see it until you publish.`
                : "Nobody else can see this until you publish."
              : prefilledFromPublished
                ? "Prefilled from your latest published version. Edit what has changed, then save or publish."
                : "Fill in what you can — you can save a draft and come back."}
          </p>
        </CardHeader>
        <Divider />
        <CardBody className="gap-4 px-6">
          {statusBanner}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label={labelWithHelp("Word for the Box", EIGHT_BOX_WORD_HELP)}
              description="One word — the ethos of this box. It goes in the middle of the page so you remember it."
              placeholder="Steady · Present · Finish"
              value={content.word}
              onValueChange={(word) =>
                setContent((prev) => ({ ...prev, word }))
              }
              maxLength={EIGHT_BOX_WORD_MAX}
              variant="bordered"
              classNames={{ input: "font-semibold uppercase tracking-wide" }}
            />
            <Input
              label={labelWithHelp("Period", EIGHT_BOX_PERIOD_HELP)}
              description="How you'll recognise this version later — the quarter by default."
              value={period}
              onValueChange={setPeriod}
              maxLength={EIGHT_BOX_PERIOD_MAX_CHARS}
              isInvalid={!periodValid}
              errorMessage={!periodValid ? "Period is required." : undefined}
              variant="bordered"
            />
          </div>
        </CardBody>
        <Divider />
        <CardFooter className="flex flex-col items-stretch gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-foreground/50">
            {isDirty ? "Unsaved changes" : "Draft saved"}
          </span>
          {actions}
        </CardFooter>
      </Card>

      {EIGHT_BOX_DEFINITIONS.map(renderBox)}

      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
        <CardBody className="gap-3 px-6">
          {statusBanner}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-foreground/50">
              {isDirty ? "Unsaved changes" : "Draft saved"}
            </span>
            {actions}
          </div>
        </CardBody>
      </Card>

      <EightBoxPreviewModal
        isOpen={previewModal.isOpen}
        onOpenChange={previewModal.onOpenChange}
        content={content}
        period={period}
        f3Name={f3Name}
        version={nextVersion}
      />

      <Modal
        isOpen={publishModal.isOpen}
        onOpenChange={publishModal.onOpenChange}
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader>Publish as version {nextVersion}?</ModalHeader>
          <ModalBody className="text-sm text-foreground/80">
            <p>
              <strong>{period.trim()}</strong> will be saved to your history as
              version {nextVersion}. Published versions can&apos;t be edited —
              only deleted — and you can share one by link once it&apos;s
              published.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={publishModal.onClose}
              isDisabled={busy !== null}
            >
              Keep editing
            </Button>
            <Button
              color="primary"
              onPress={handlePublish}
              isLoading={busy === "publish"}
              isDisabled={busy !== null}
            >
              Publish
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
