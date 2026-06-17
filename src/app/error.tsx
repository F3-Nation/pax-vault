"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { makeErrorId, reportError } from "@/lib/observability";

/**
 * Avoid leaking internal details while still giving the user something actionable.
 */
function getUserMessage(error: Error): string {
  const msg = (error?.message || "").trim();
  // Many runtime errors already contain useful context; cap it to keep UI tidy.
  if (msg.length >= 8 && msg.length <= 140) return msg;
  return "We hit an unexpected issue while loading this page.";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const errorId = useMemo(() => makeErrorId(error), [error]);

  useEffect(() => {
    reportError(error, { scope: "client/error-boundary", errorId });
  }, [error, errorId]);

  const userMessage = useMemo(() => getUserMessage(error), [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-gradient-to-b from-background to-default-50">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-default-200 bg-background/80 backdrop-blur p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-50 text-danger-600">
              <span className="text-2xl" aria-hidden>
                ⚠️
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                Something went wrong
              </h1>
              <p className="mt-2 text-default-600">{userMessage}</p>
              <p className="mt-3 text-sm text-default-500">
                Error ID: <span className="font-mono">{errorId}</span>
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Try again
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-default-200 bg-background px-5 py-3 text-sm font-medium text-default-700 hover:bg-default-100 focus:outline-none focus:ring-2 focus:ring-default-300"
            >
              Go to home
            </Link>
          </div>

          <div className="mt-6">
            <details className="rounded-xl border border-default-200 bg-default-50/50 p-4">
              <summary className="cursor-pointer select-none text-sm font-medium text-default-700">
                Technical details
              </summary>
              <div className="mt-3 space-y-2">
                <div className="text-sm">
                  <div className="text-default-500">Name</div>
                  <div className="font-mono text-default-700">{error.name}</div>
                </div>
                <div className="text-sm">
                  <div className="text-default-500">Message</div>
                  <div className="font-mono text-default-700 whitespace-pre-wrap break-words">
                    {error.message || "(no message)"}
                  </div>
                </div>
              </div>
            </details>
          </div>

          <p className="mt-6 text-xs text-default-500">
            Tip: If this keeps happening, grab a screenshot of this page
            (including the Error ID) and share it with the dev team.
          </p>
        </div>
      </div>
    </main>
  );
}
