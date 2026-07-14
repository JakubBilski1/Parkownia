import { NextResponse, type NextRequest } from "next/server";
import { badRequest, errorResponse } from "@/modules/parkings/errors";
import { parkingPatchSchema } from "@/modules/parkings/schemas";
import { createDraft } from "@/modules/parkings/service";
import { requireHost } from "@/modules/parkings/session";

export const dynamic = "force-dynamic";

/**
 * The FIRST autosave of the add-parking form, so it must accept exactly what that
 * form sends — and the form sends explicit nulls for every field the host has not
 * filled in yet (buildPayload() in parking-form.tsx).
 *
 * This used to validate with parkingWriteSchema, whose fields are `.optional()` but
 * not `.nullable()`. Zod rejected the nulls, every POST answered 400, and so the
 * DRAFT was never created: a host could fill in the whole form, close the tab, and
 * find nothing saved — the exact failure DESIGN_PRINCIPLES §6.3 forbids. Submitting
 * did not work either, because submit() saves first.
 *
 * parkingPatchSchema is the same schema with nulls allowed, which for a create means
 * "not set yet" instead of "clear it". Same thing on an empty row.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireHost(request);
    const parsed = parkingPatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw badRequest(parsed.error);
    }

    const draft = await createDraft(session, parsed.data);
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
