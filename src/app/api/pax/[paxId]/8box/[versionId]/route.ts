/**
 * 8 Box per-row API.
 *
 * PATCH  — body `{ shared: boolean }`: turn the share link for a PUBLISHED
 *          version on or off (409 for a draft).
 * DELETE — hard-delete a draft ("Discard draft") or a published version.
 *
 * Both owner-only. Reads are scoped to the pax id in the URL, so a row id
 * belonging to someone else reads as "not found" (404), never as theirs.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { isOwnPax } from "@/lib/auth/permissions";
import {
  deleteEightBoxRecord,
  getEightBoxVersionPageData,
  setEightBoxShared,
} from "@/lib/bq/eightBox";
import {
  failureResponse,
  forbidden,
  parsePaxId,
  parseVersionId,
  readJsonBody,
} from "../shared";

type RouteContext = { params: Promise<{ paxId?: string; versionId?: string }> };

function notFound() {
  return NextResponse.json({ error: "Version not found." }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const paxId = parsePaxId(params?.paxId);
  if (paxId === null) {
    return NextResponse.json({ error: "Invalid pax id" }, { status: 400 });
  }
  const versionId = parseVersionId(params?.versionId);
  if (versionId === null) {
    return NextResponse.json({ error: "Invalid version id" }, { status: 400 });
  }

  const body = await readJsonBody(request);
  const shared = (body as { shared?: unknown } | null)?.shared;
  if (typeof shared !== "boolean") {
    return NextResponse.json(
      { error: "Body must be { shared: boolean }" },
      { status: 400 },
    );
  }

  try {
    if (!(await isOwnPax(paxId))) return forbidden();

    const { record } = await getEightBoxVersionPageData(
      paxId,
      versionId,
      user.email,
    );
    if (!record) return notFound();
    if (record.status !== "published") {
      return NextResponse.json(
        { error: "Only published versions can be shared." },
        { status: 409 },
      );
    }

    await setEightBoxShared(paxId, versionId, shared, user.email);

    return NextResponse.json(
      {
        id: versionId,
        shared,
        sharedAt: shared ? new Date().toISOString() : null,
      },
      { status: 200 },
    );
  } catch (err) {
    return failureResponse(
      err,
      "api/pax/8box/version:PATCH",
      user.email,
      { paxId, versionId },
      "Could not update sharing. Please try again.",
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const paxId = parsePaxId(params?.paxId);
  if (paxId === null) {
    return NextResponse.json({ error: "Invalid pax id" }, { status: 400 });
  }
  const versionId = parseVersionId(params?.versionId);
  if (versionId === null) {
    return NextResponse.json({ error: "Invalid version id" }, { status: 400 });
  }

  try {
    if (!(await isOwnPax(paxId))) return forbidden();

    const { record } = await getEightBoxVersionPageData(
      paxId,
      versionId,
      user.email,
    );
    if (!record) return notFound();

    await deleteEightBoxRecord(paxId, versionId, user.email);

    return NextResponse.json(
      { id: versionId, deleted: true, status: record.status },
      { status: 200 },
    );
  } catch (err) {
    return failureResponse(
      err,
      "api/pax/8box/version:DELETE",
      user.email,
      { paxId, versionId },
      "Could not delete. Please try again.",
    );
  }
}
