/**
 * 8 Box publish API.
 *
 * POST — save the submitted boxes AND publish them as the next immutable
 *        version, in one MERGE. If a draft exists it becomes the published
 *        row; otherwise a published row is inserted directly. Owner-only.
 */
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { isOwnPax } from "@/lib/auth/permissions";
import { getEightBoxPageData, publishEightBox } from "@/lib/bq/eightBox";
import { validateEightBoxSubmission } from "@/lib/eightBox";
import {
  failureResponse,
  forbidden,
  parsePaxId,
  readJsonBody,
} from "../shared";

export async function POST(
  request: Request,
  context: { params: Promise<{ paxId?: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const paxId = parsePaxId(params?.paxId);
  if (paxId === null) {
    return NextResponse.json({ error: "Invalid pax id" }, { status: 400 });
  }

  const body = await readJsonBody(request);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (!(await isOwnPax(paxId))) return forbidden();

    const validated = validateEightBoxSubmission(body, {
      requireContent: true,
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // One read gives both the draft id to reuse and the next version number.
    // Deleting a version never renumbers the rest, so "max + 1" is right even
    // with gaps.
    const existing = await getEightBoxPageData(paxId, user.email);
    const id = existing.draft?.id ?? randomUUID();
    const maxVersion = existing.versions.reduce(
      (max, v) => Math.max(max, v.version ?? 0),
      0,
    );
    const version = maxVersion + 1;

    await publishEightBox(
      {
        id,
        paxId,
        version,
        period: validated.period,
        content: validated.content,
      },
      user.email,
    );

    return NextResponse.json(
      { id, version, period: validated.period },
      { status: 201 },
    );
  } catch (err) {
    return failureResponse(
      err,
      "api/pax/8box/publish:POST",
      user.email,
      { paxId },
      "Could not publish your 8 Box. Please try again.",
    );
  }
}
