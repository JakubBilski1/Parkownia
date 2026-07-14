"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
// Only async functions may be EXPORTED from a "use server" file. ActionResult and
// IDLE therefore live next door, in ./action-result — importing them here is fine.
import type { ActionResult } from "./action-result";
import { deleteCommissionOverride, setCommissionRule } from "@/modules/admin/commissions";
import { AdminError } from "@/modules/admin/errors";
import { createEvent, deleteEvent, updateEvent } from "@/modules/admin/events";
import { formatMoney } from "@/lib/format";
import { reviewParking } from "@/modules/admin/moderation";
import { generatePayouts, markPayoutPaid } from "@/modules/admin/payouts";
import { requireAdmin } from "@/modules/admin/session";
import { warsawToUtc } from "@/modules/admin/time";
import { refundBooking } from "@/modules/admin/transactions";
import { createVenue, deleteVenue } from "@/modules/admin/venues";

/**
 * Server actions are a second front door to the same domain modules, so they get
 * the same admin check and the same Zod parse (done inside each module function).
 */
async function run(fn: () => Promise<{ message: string; detail?: string }>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { message, detail } = await fn();
    return detail ? { status: "ok", message, detail } : { status: "ok", message };
  } catch (error) {
    if (error instanceof AdminError) {
      return { status: "error", message: error.userMessage };
    }
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "_";
        if (!(key in fields)) fields[key] = issue.message;
      }
      return { status: "error", message: "Popraw zaznaczone pola.", fields };
    }
    console.error("[admin] action failed", error instanceof Error ? error.message : "unknown");
    return {
      status: "error",
      message: "Operacja nie została wykonana. Nic się nie zmieniło. Spróbuj ponownie.",
    };
  }
}

function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/* -------------------------------------------------------------------------- */
/* Moderation                                                                 */
/* -------------------------------------------------------------------------- */

export async function reviewParkingAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const result = await reviewParking({
      parkingId: text(form, "parkingId"),
      decision: text(form, "decision"),
      reason: text(form, "reason"),
    });

    revalidatePath("/admin/moderacja");
    revalidatePath("/admin");

    const message = result.decision === "ACTIVE" ? "Parking zatwierdzony." : "Parking odrzucony.";
    return {
      message,
      detail: result.mailSent
        ? "Host dostał wiadomość."
        : "Host NIE dostał maila — moduł powiadomień nie jest podpięty. Powiadom go sam.",
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Refunds                                                                    */
/* -------------------------------------------------------------------------- */

export async function refundAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const zloty = text(form, "amountZl");
    const result = await refundBooking({
      bookingId: text(form, "bookingId"),
      // The operator types złote; the database only ever sees grosze.
      amountGr: zloty ? Math.round(Number(zloty.replace(",", ".")) * 100) : undefined,
    });

    revalidatePath("/admin/transakcje");
    revalidatePath("/admin/wyplaty");
    revalidatePath("/admin");

    return {
      message: `Zwrot ${formatMoney(result.refundedNowGr)} wykonany (${result.code}).`,
      detail:
        result.hostAlreadyPaidGr > 0
          ? `Host dostał już swoją część (${formatMoney(result.hostAlreadyPaidGr)}). Potrąć ją z następnej wypłaty ręcznie.`
          : `Prowizja platformy pomniejszona o ${formatMoney(result.platformShareGr)}, wypłata hosta o ${formatMoney(result.hostShareGr)}.`,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Commissions                                                                */
/* -------------------------------------------------------------------------- */

export async function setCommissionAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const result = await setCommissionRule({
      scope: text(form, "scope"),
      userId: text(form, "userId"),
      parkingId: text(form, "parkingId"),
      ratePct: text(form, "ratePct"),
    });

    revalidatePath("/admin/prowizje");

    return {
      message: `Stawka ${result.ratePct}% zapisana.`,
      detail: "Rezerwacje sprzedane wcześniej zachowują swoją starą stawkę.",
    };
  });
}

export async function deleteCommissionAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    await deleteCommissionOverride({ ruleId: text(form, "ruleId") });
    revalidatePath("/admin/prowizje");
    return { message: "Nadpisanie usunięte. Obowiązuje stawka globalna." };
  });
}

/* -------------------------------------------------------------------------- */
/* Payouts                                                                    */
/* -------------------------------------------------------------------------- */

export async function generatePayoutsAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const result = await generatePayouts({
      periodStart: text(form, "periodStart"),
      periodEnd: text(form, "periodEnd"),
    });

    revalidatePath("/admin/wyplaty");

    if (result.settledBookings === 0) {
      return {
        message: "Nie ma czego rozliczyć.",
        detail: "Żadna opłacona rezerwacja z tego okresu nie czeka na wypłatę.",
      };
    }

    return {
      message: `Utworzono ${result.createdPayouts} wypłat na ${formatMoney(result.totalGr)}.`,
      detail:
        result.skippedHosts.length > 0
          ? `${result.skippedHosts.length} hostów pominięto — mają już rozliczony ten okres. Rozlicz ich w kolejnym.`
          : `Rozliczono ${result.settledBookings} rezerwacji.`,
    };
  });
}

export async function markPaidAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const result = await markPayoutPaid({
      payoutId: text(form, "payoutId"),
      providerRef: text(form, "providerRef"),
    });

    revalidatePath("/admin/wyplaty");
    revalidatePath("/admin");

    return { message: `Wypłata ${formatMoney(result.amountGr)} oznaczona jako wypłacona.` };
  });
}

/* -------------------------------------------------------------------------- */
/* Venues and events                                                          */
/* -------------------------------------------------------------------------- */

export async function createVenueAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    await createVenue({
      name: text(form, "name"),
      address: text(form, "address"),
      lat: text(form, "lat"),
      lng: text(form, "lng"),
      capacity: text(form, "capacity"),
    });
    revalidatePath("/admin/wydarzenia");
    return { message: "Obiekt dodany." };
  });
}

export async function deleteVenueAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    await deleteVenue(text(form, "venueId") ?? "");
    revalidatePath("/admin/wydarzenia");
    return { message: "Obiekt usunięty." };
  });
}

export async function saveEventAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const eventId = text(form, "eventId");

    const payload = {
      venueId: text(form, "venueId"),
      title: text(form, "title"),
      description: text(form, "description"),
      // The operator types Warsaw wall-clock time; the database stores UTC.
      startsAt: warsawToUtc(text(form, "startsAt")),
      endsAt: warsawToUtc(text(form, "endsAt")),
      category: text(form, "category"),
      expectedAttendance: text(form, "expectedAttendance"),
      searchRadiusMeters: text(form, "searchRadiusMeters"),
    };

    if (eventId) {
      await updateEvent({ ...payload, eventId });
    } else {
      await createEvent(payload);
    }

    revalidatePath("/admin/wydarzenia");
    return { message: eventId ? "Wydarzenie zapisane." : "Wydarzenie dodane." };
  });
}

export async function deleteEventAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    await deleteEvent(text(form, "eventId") ?? "");
    revalidatePath("/admin/wydarzenia");
    return { message: "Wydarzenie usunięte." };
  });
}
