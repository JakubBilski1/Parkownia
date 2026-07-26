import type { NextRequest } from "next/server";
import { handle, searchParamsToObject } from "@/modules/admin/http";
import { listLeads } from "@/modules/admin/leads";
import { requireAdmin } from "@/modules/admin/session";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    return listLeads(searchParamsToObject(request.url));
  });
}
