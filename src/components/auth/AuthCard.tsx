"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createSession } from "@/lib/auth/client";

function normalizeRedirect(path: string | null) {
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  return path;
}

export default function AuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkMode, setLinkMode] = useState(false);

  const redirectTo = useMemo(
    () => normalizeRedirect(searchParams?.get("redirect") ?? null),
    [searchParams],
  );

  const finishSignIn = useCallback(
    async (emailToUse: string, href: string) => {
      setBusy(true);
      setError(null);
      setStatus(null);

      try {
        const credential = await signInWithEmailLink(auth, emailToUse, href);
        window.localStorage.removeItem("emailForSignIn");

        const idToken = await credential.user.getIdToken();
        await createSession(idToken);

        if (redirectTo) {
          router.replace(redirectTo);
        } else {
          router.replace("/");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sign-in failed";
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [redirectTo, router],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) return;

    setLinkMode(true);

    const storedEmail = window.localStorage.getItem("emailForSignIn");
    if (storedEmail) {
      setEmail(storedEmail);
      void finishSignIn(storedEmail, href);
    } else {
      setStatus("Enter the email you used to finish signing in.");
    }
  }, [finishSignIn]);

  const handleSendLink = useCallback(async () => {
    setError(null);
    setStatus(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email address to continue.");
      return;
    }

    setBusy(true);

    try {
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!checkRes.ok) {
        const payload = (await checkRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        const message =
          payload?.error ||
          (checkRes.status === 404
            ? "Email does not match a PAX member."
            : "Unable to validate email.");
        setError(message);
        setBusy(false);
        return;
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const actionUrl = new URL(baseUrl);
      if (redirectTo) {
        actionUrl.searchParams.set("redirect", redirectTo);
      }

      await sendSignInLinkToEmail(auth, trimmed, {
        url: actionUrl.toString(),
        handleCodeInApp: true,
      });

      window.localStorage.setItem("emailForSignIn", trimmed);
      setStatus("Check your email for the sign-in link.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send link";
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [email, redirectTo]);

  const handleFinish = useCallback(async () => {
    if (typeof window === "undefined") return;
    const href = window.location.href;
    await finishSignIn(email.trim(), href);
  }, [email, finishSignIn]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/");
  }, [router, signOut]);

  if (loading) {
    return (
      <Card
        shadow="none"
        className="border border-default-200/60 bg-default-50/80 dark:bg-default-100/60"
      >
        <CardHeader className="flex items-center justify-between">
          <div className="text-sm font-semibold">Access</div>
          <Chip size="sm" variant="flat">
            Checking session…
          </Chip>
        </CardHeader>
        <CardBody className="text-sm text-foreground/70">
          Loading authentication status.
        </CardBody>
      </Card>
    );
  }

  if (user) {
    return (
      <Card
        shadow="none"
        className="border border-default-200/60 bg-default-50/80 dark:bg-default-100/60"
      >
        <CardHeader className="flex items-center justify-between">
          <div className="text-sm font-semibold">You&apos;re signed in</div>
          <Chip size="sm" color="success" variant="flat">
            Active
          </Chip>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-foreground/70">
            Signed in as <span className="font-semibold">{user.email}</span>.
          </p>
          <div>
            <Button
              size="sm"
              color="danger"
              variant="flat"
              onPress={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card
      id="signin"
      shadow="none"
      className="border border-default-200/60 bg-default-50/80 dark:bg-default-100/60"
    >
      <CardHeader className="flex items-center justify-between">
        <div className="text-sm font-semibold">Secure Access</div>
        <Chip size="sm" variant="flat">
          Email Link
        </Chip>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-foreground/70">
          Enter your email and we&apos;ll send a sign-in link. No password
          required.
        </p>

        <Input
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onValueChange={setEmail}
          variant="bordered"
          isRequired
        />

        {linkMode ? (
          <Button
            color="primary"
            onPress={handleFinish}
            isLoading={busy}
            isDisabled={!email.trim()}
          >
            Finish sign-in
          </Button>
        ) : (
          <Button color="primary" onPress={handleSendLink} isLoading={busy}>
            Send sign-in link
          </Button>
        )}

        {status && <div className="text-sm text-success-600">{status}</div>}
        {error && <div className="text-sm text-danger-500">{error}</div>}

        {redirectTo && (
          <div className="text-xs text-foreground/60">
            After signing in you&apos;ll be sent to <code>{redirectTo}</code>.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
