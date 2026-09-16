/**
 * Helpers shared by the 8 Box API routes.
 *
 * Every route follows the same envelope as the region preferences route:
 * 401 without a session, 400 for a bad id or body, 403 when the session user
 * is not the PAX in the URL, and — on failure — a 500/503 with an `errorId`
 * so the UI's error path fires (never a 200 with empty data; see the
 * search-silent-failures postmortem).
 */
import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { isWritePermissionError } from "@/lib/bq/preferences";

export const EIGHT_BOX_TABLE_NAME = "pv_pax_eight_box";

/** Parse and validate the route's pax id. Returns null when unusable. */
export function parsePaxId(raw: string | undefined): number | null {
  const paxId = Number(raw);
  if (!raw || !Number.isInteger(paxId) || paxId <= 0) return null;
  return paxId;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Row ids are UUID v4s minted by the app; anything else is a bad request. */
export function parseVersionId(raw: string | undefined): string | null {
  if (!raw || !UUID_RE.test(raw)) return null;
  return raw.toLowerCase();
}

/** Read a JSON body, returning null for anything that isn't valid JSON. */
export async function readJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** 403 body — deliberately does not say whether the PAX exists. */
export function forbidden() {
  return NextResponse.json(
    { error: "You can only manage your own 8 Box." },
    { status: 403 },
  );
}

/**
 * Turn a thrown error into the standard failure response. The read-only
 * service account case gets an actionable 503 naming the missing grant
 * instead of a generic 500 that sends someone hunting through logs.
 */
export function failureResponse(
  err: unknown,
  scope: string,
  userEmail: string,
  extra: Record<string, unknown>,
  fallbackMessage: string,
) {
  const errorId = reportError(err, { scope, user: userEmail, extra });

  if (isWritePermissionError(err)) {
    return NextResponse.json(
      {
        error: `Your 8 Box could not be saved: the BigQuery service account does not have write access to ${EIGHT_BOX_TABLE_NAME}. An administrator needs to grant it before saving will work.`,
        errorId,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: fallbackMessage, errorId },
    { status: 500 },
  );
}
