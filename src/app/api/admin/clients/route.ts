import type { NextRequest } from "next/server";
import { listClients } from "@/modules/admin/clients";
import { handle, searchParamsToObject } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    return listClients(searchParamsToObject(request.url));
  });
}
