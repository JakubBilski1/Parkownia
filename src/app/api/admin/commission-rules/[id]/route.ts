import { deleteCommissionOverride } from "@/modules/admin/commissions";
import { handle } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";

type Params = { params: Promise<{ id: string }> };

/**
 * Not in API_SPEC §9 (integration item). Without it an override, once set, would
 * shadow the global rate forever — there would be no way back to 50/30.
 */
export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    return deleteCommissionOverride({ ruleId: id });
  });
}
