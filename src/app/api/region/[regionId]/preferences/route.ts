/**
 * Region preferences API route.
 *
 * GET  — any signed-in user may read a region's preferences (they describe how
 *        the region page renders, so readers need them too).
 * PUT  — restricted to users holding the admin role (role_id 3) on that
 *        region's org_id.
 *
 * The permission check is re-run here rather than trusted from the client: the
 * button and the page gate are UI affordances, this is the enforcement point.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/server";
import { getRegionAOIds } from "@/lib/bq/regions";
import { getRegionPermissionForSession } from "@/lib/auth/permissions";
import {
  getRegionPreferences,
  isWritePermissionError,
  saveRegionPreferences,
} from "@/lib/bq/preferences";
import { coerceRegionPreferences } from "@/lib/preferences";
import { reportError } from "@/lib/observability";

/** Parse and validate the route's region id. Returns null when unusable. */
function parseRegionId(raw: string | undefined): number | null {
  const regionId = Number(raw);
  if (!raw || !Number.isInteger(regionId) || regionId <= 0) return null;
  return regionId;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ regionId?: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const regionId = parseRegionId(params?.regionId);
  if (regionId === null) {
    return NextResponse.json({ error: "Invalid region id" }, { status: 400 });
  }

  try {
    const [record, permission] = await Promise.all([
      getRegionPreferences(regionId, user.email),
      getRegionPermissionForSession(regionId),
    ]);

    return NextResponse.json(
      { ...record, canEdit: permission.isAdmin },
      { status: 200 },
    );
  } catch (err) {
    const errorId = reportError(err, {
      scope: "api/region/preferences:GET",
      user: user.email,
      extra: { regionId },
    });
    return NextResponse.json(
      { error: "Could not load region preferences.", errorId },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ regionId?: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const regionId = parseRegionId(params?.regionId);
  if (regionId === null) {
    return NextResponse.json({ error: "Invalid region id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const permission = await getRegionPermissionForSession(regionId);

    // Both branches are 403 rather than 404/401: whether the account is
    // unknown or merely unprivileged is not something to advertise.
    if (!permission.isAdmin || permission.userId === null) {
      return NextResponse.json(
        { error: "You do not have permission to edit this region." },
        { status: 403 },
      );
    }

    // Unknown keys are dropped here — only fields the app understands are
    // persisted, so a hostile body cannot smuggle data into json_config.
    const preferences = coerceRegionPreferences(
      (body as { preferences?: unknown })?.preferences ?? body,
    );

    await saveRegionPreferences(
      regionId,
      preferences,
      permission.userId,
      user.email,
    );

    // Preferences are baked into the cached region and AO page payloads, so a
    // save must invalidate both or the change won't surface for up to an hour
    // (STATS_REVALIDATE_SECONDS). PAX pages do not inherit region preferences,
    // so they are deliberately left alone.
    //
    // The write already succeeded — a revalidation failure must not be
    // reported to the user as a failed save, so it is logged and swallowed.
    // `{ expire: 0 }` is Next 16's required cache-profile argument, asking for
    // immediate expiry rather than the tag's normal lifetime.
    try {
      revalidateTag(`region-${regionId}`, { expire: 0 });
      const aoIds = await getRegionAOIds(regionId, user.email);
      for (const aoId of aoIds) {
        revalidateTag(`ao-${aoId}`, { expire: 0 });
      }
    } catch (revalidateErr) {
      reportError(revalidateErr, {
        scope: "api/region/preferences:revalidate",
        user: user.email,
        extra: { regionId },
      });
    }

    return NextResponse.json({ preferences, saved: true }, { status: 200 });
  } catch (err) {
    const errorId = reportError(err, {
      scope: "api/region/preferences:PUT",
      user: user.email,
      extra: { regionId },
    });

    // Surface the read-only-service-account case explicitly. Returning a
    // generic 500 here sends whoever debugs it hunting through logs for what
    // is really a one-line IAM grant.
    if (isWritePermissionError(err)) {
      return NextResponse.json(
        {
          error:
            "Preferences could not be saved: the BigQuery service account does not have write access to pv_regions_preferences. An administrator needs to grant it before saving will work.",
          errorId,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: "Could not save region preferences. Please try again.",
        errorId,
      },
      { status: 500 },
    );
  }
}
