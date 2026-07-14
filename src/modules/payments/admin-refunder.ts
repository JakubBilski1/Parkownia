import { getPaymentProvider } from "./factory";

/**
 * Adapter for the admin module's `PaymentRefunder` port
 * (src/modules/admin/ports.ts → registerPaymentRefunder). Structurally typed
 * rather than imported, so the two modules stay decoupled — if the port's shape
 * changes, the wiring line fails to compile, which is the failure mode we want.
 *
 * Wire it once at boot (integration phase):
 *
 *   import { registerPaymentRefunder } from "@/modules/admin/ports";
 *   import { createAdminRefunder } from "@/modules/payments/admin-refunder";
 *   registerPaymentRefunder(createAdminRefunder());
 */
export type AdminRefundRequest = {
  paymentId: string;
  provider: "MANUAL" | "STRIPE" | "P24" | "AUTOPAY";
  providerRef: string | null;
  amountGr: number;
  hostShareGr: number;
};

export type AdminRefundResult = { providerRefundRef: string | null };

export type AdminRefunder = {
  refund: (request: AdminRefundRequest) => Promise<AdminRefundResult>;
};

export function createAdminRefunder(): AdminRefunder {
  return {
    async refund(request) {
      if (!request.providerRef) {
        throw new Error("Refund requested for a payment with no provider reference");
      }

      const result = await getPaymentProvider().refund({
        providerRef: request.providerRef,
        amountGr: request.amountGr,
        // An admin refund is still a marketplace refund: the host gives back
        // their share and we give back ours, in proportion. Refunding only the
        // platform's cut would mean paying the driver out of our own pocket.
        reverseTransfer: request.hostShareGr > 0,
        refundApplicationFee: true,
      });

      return { providerRefundRef: result.providerRefundRef };
    },
  };
}
