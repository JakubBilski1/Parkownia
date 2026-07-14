import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROUTES } from "@/components/nav/routes";
import { ParkingForm } from "../_components/parking-form";
// From the plain module, not from parking-form: a "use client" export reaches a
// Server Component as a client reference, and spreading that yields nothing.
import { EMPTY_FORM } from "../_components/parking-form-values";
import { getSession } from "@/modules/parkings/session";

export const metadata: Metadata = { title: "Dodaj parking" };
export const dynamic = "force-dynamic";

export default async function NewParkingPage() {
  const session = await getSession();

  if (!session) {
    redirect("/logowanie?next=/panel/parkingi/nowy");
  }

  // /konto/zostan-hostem is not a route. Sending a driver who wants to list a
  // parking to a 404 is the cheapest possible way to lose supply.
  if (!session.roles.some((role) => role === "HOST_INDIVIDUAL" || role === "HOST_BUSINESS")) {
    redirect(ROUTES.becomeHost);
  }

  const initial = {
    ...EMPTY_FORM,
    ownerType: session.roles.includes("HOST_BUSINESS")
      ? ("BUSINESS" as const)
      : ("INDIVIDUAL" as const),
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1 text-ink">Dodaj parking</h1>
        <p className="text-body text-muted">
          Zacznij od pięciu pól. Szkic zapisuje się sam — możesz zamknąć kartę i wrócić.
        </p>
      </header>

      <ParkingForm initial={initial} />
    </div>
  );
}
