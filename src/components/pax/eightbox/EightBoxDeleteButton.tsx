"use client";

/**
 * EightBoxDeleteButton
 *
 * Confirm-then-DELETE for a draft ("Discard draft") or a published version.
 * Deletion is permanent from the user's point of view, so it always goes
 * through a modal. Owner-only; the route re-checks.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@heroui/alert";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { useDisclosure } from "@heroui/use-disclosure";

type Props = {
  paxId: number;
  versionId: string;
  /** Human label for the confirm dialog, e.g. "version 3 (2026-Q1)". */
  label: string;
  kind: "draft" | "published";
  /** Where to go after a successful delete; refreshes in place when omitted. */
  redirectTo?: string;
  size?: "sm" | "md";
  variant?: "flat" | "light" | "bordered";
};

export function EightBoxDeleteButton({
  paxId,
  versionId,
  label,
  kind,
  redirectTo,
  size = "sm",
  variant = "light",
}: Props) {
  const router = useRouter();
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    message: string;
    errorId?: string;
  } | null>(null);

  const actionLabel = kind === "draft" ? "Discard draft" : "Delete";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pax/${paxId}/8box/${versionId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        errorId?: string;
      } | null;

      if (!res.ok) {
        setError({
          message: data?.error ?? `Delete failed (HTTP ${res.status}).`,
          errorId: data?.errorId,
        });
        return;
      }

      onClose();
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch {
      setError({ message: "Could not reach the server. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size={size} variant={variant} color="danger" onPress={onOpen}>
        {actionLabel}
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            {kind === "draft" ? "Discard this draft?" : `Delete ${label}?`}
          </ModalHeader>
          <ModalBody className="text-sm text-foreground/80">
            {kind === "draft" ? (
              <p>
                Your unsaved-to-history work will be thrown away. Published
                versions are not affected.
              </p>
            ) : (
              <p>
                This cannot be undone. If this version was shared, its link will
                stop working.
              </p>
            )}
            {error && (
              <Alert
                color="danger"
                title="Not deleted"
                description={
                  error.errorId
                    ? `${error.message} (reference: ${error.errorId})`
                    : error.message
                }
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose} isDisabled={busy}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={confirm}
              isLoading={busy}
              isDisabled={busy}
            >
              {actionLabel}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
