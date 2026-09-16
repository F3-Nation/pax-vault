/**
 * 8 Box draft API.
 *
 * PUT — upsert the signed-in PAX's single draft. Owner-only: the edit page
 *       gates for UX, this route is the enforcement point.
 */
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { isOwnPax } from "@/lib/auth/permissions";
import { getEightBoxPageData, saveEightBoxDraft } from "@/lib/bq/eightBox";
import { validateEightBoxSubmission } from "@/lib/eightBox";
import {
  failureResponse,
  forbidden,
  parsePaxId,
  readJsonBody,
} from "../shared";

export async function PUT(
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

    // Unknown keys are dropped here — only the eight boxes and the period
    // are persisted, so a hostile body cannot smuggle data into json_content.
    const validated = validateEightBoxSubmission(body, {
      requireContent: false,
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // Reuse the existing draft's id so the client can keep referring to it
    // (e.g. for "Discard draft"); mint one only when this is the first save.
    const existing = await getEightBoxPageData(paxId, user.email);
    const id = existing.draft?.id ?? randomUUID();

    await saveEightBoxDraft(
      { id, paxId, period: validated.period, content: validated.content },
      user.email,
    );

    return NextResponse.json(
      { id, period: validated.period, content: validated.content },
      { status: 200 },
    );
  } catch (err) {
    return failureResponse(
      err,
      "api/pax/8box/draft:PUT",
      user.email,
      { paxId },
      "Could not save your draft. Please try again.",
    );
  }
}
