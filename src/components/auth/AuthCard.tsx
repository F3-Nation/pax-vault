"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { useAuth } from "@/lib/auth/AuthProvider";

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized: "Your email does not match a PAX member.",
  token_exchange_failed: "Sign-in failed. Please try again.",
  userinfo_failed: "Could not retrieve your account info. Please try again.",
  allowlist_error: "Unable to verify membership. Please try again later.",
  csrf_mismatch: "Security check failed. Please try again.",
  expired_state: "Sign-in link expired. Please try again.",
  invalid_state: "Invalid sign-in request. Please try again.",
  missing_params: "Incomplete sign-in response. Please try again.",
};

function normalizeRedirect(path: string | null) {
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  return path;
}

export default function AuthCard() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const redirectTo = useMemo(
    () => normalizeRedirect(searchParams?.get("redirect") ?? null),
    [searchParams],
  );

  const errorParam = searchParams?.get("error") ?? null;
  const errorMessage = errorParam
    ? (ERROR_MESSAGES[errorParam] ?? "An error occurred during sign-in.")
    : null;

  const handleSignIn = () => {
    const loginUrl = new URL("/api/auth/login", window.location.origin);
    if (redirectTo) {
      loginUrl.searchParams.set("returnTo", redirectTo);
    }
    window.location.href = loginUrl.toString();
  };

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
          <div className="text-sm font-semibold">
            Congrats! You&apos;re signed in
          </div>
          <Chip size="sm" color="success" variant="flat">
            Active
          </Chip>
        </CardHeader>
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
          F3 Nation
        </Chip>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-foreground/70">
          Sign in with your F3 Nation account to access region stats, event
          history, and leadership tools.
        </p>
        <div className="rounded-md border border-danger-200 px-3 py-2 text-sm text-danger dark:border-danger dark:text-danger">
          <strong>Why sign in?</strong>
          <div className="mt-1">
            Signing in verifies you as an active PAX member and unlocks access
            to region stats, event history, and leadership tools that
            aren&apos;t available to the public.
          </div>
        </div>

        <Button color="primary" onPress={handleSignIn} fullWidth>
          Sign in with F3 Nation
        </Button>

        {errorMessage && (
          <div className="text-sm text-danger-500">{errorMessage}</div>
        )}

        {redirectTo && (
          <div className="text-xs text-foreground/60">
            After signing in you&apos;ll be sent to <code>{redirectTo}</code>.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
