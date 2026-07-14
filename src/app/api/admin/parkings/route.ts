import type { NextRequest } from "next/server";
import { handle, searchParamsToObject } from "@/modules/admin/http";
import { listModerationQueue } from "@/modules/admin/moderation";
import { requireAdmin } from "@/modules/admin/session";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    return listModerationQueue(searchParamsToObject(request.url));
  });
}
