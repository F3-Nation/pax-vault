"use client";

/**
 * Landing-page hero call-to-action.
 *
 * Signed out: kicks off the F3 Nation OAuth flow (preserving `?redirect=`).
 * Signed in:  offers real entry points instead — the Nation dashboard plus the
 *             configured sample PAX / Region. Those `/stats/*` routes sit
 *             behind middleware auth, so they're only shown once a session
 *             exists; otherwise the links would just bounce back here.
 *
 * Renders a fragment (buttons + supporting caption) so the parent's flex gap
 * spaces both consistently.
 */

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { normalizeRedirect, startSignIn } from "@/lib/auth/login";

type HeroActionsProps = {
  /** SAMPLE_PAX env id, or "" when unset. */
  samplePaxId: string;
  /** SAMPLE_REGION env id, or "" when unset. */
  sampleRegionId: string;
};

export default function HeroActions({
  samplePaxId,
  sampleRegionId,
}: HeroActionsProps) {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const redirectTo = useMemo(
    () => normalizeRedirect(searchParams?.get("redirect") ?? null),
    [searchParams],
  );

  if (loading) {
    return (
      <Button size="lg" color="primary" isLoading className="w-full sm:w-56">
        Checking session…
      </Button>
    );
  }

  if (user) {
    return (
      <>
        <Button
          as={Link}
          href="/stats/nation"
          size="lg"
          color="primary"
          className="w-full font-semibold sm:w-auto"
        >
          Open the Nation dashboard
        </Button>

        {(samplePaxId || sampleRegionId) && (
          <p className="text-xs text-default-500">
            Or jump straight into sample data:{" "}
            {samplePaxId && (
              <Link
                href={`/stats/pax/${samplePaxId}`}
                className="text-primary hover:underline"
              >
                a PAX
              </Link>
            )}
            {samplePaxId && sampleRegionId && " · "}
            {sampleRegionId && (
              <Link
                href={`/stats/region/${sampleRegionId}`}
                className="text-primary hover:underline"
              >
                a region
              </Link>
            )}
            .
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button
          size="lg"
          color="primary"
          className="font-semibold"
          onPress={() => startSignIn(redirectTo)}
        >
          Sign in with F3 Nation
        </Button>
        <Button as={Link} href="#tour" size="lg" variant="bordered">
          See what&apos;s inside
        </Button>
      </div>

      <p className="text-xs text-default-500">
        Sign-in verifies you as an active PAX. No new account to create —
        it&apos;s your F3 Nation login.
      </p>
    </>
  );
}
