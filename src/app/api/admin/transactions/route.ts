import type { NextRequest } from "next/server";
import { handle, searchParamsToObject } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";
import { listTransactions } from "@/modules/admin/transactions";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    return listTransactions(searchParamsToObject(request.url));
  });
}
