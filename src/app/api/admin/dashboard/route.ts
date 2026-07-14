import type { NextRequest } from "next/server";
import { getDashboard } from "@/modules/admin/dashboard";
import { handle, searchParamsToObject } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    return getDashboard(searchParamsToObject(request.url));
  });
}
