import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getBusinessProfile } from "@/modules/auth/service";
import { HostForm } from "./host-form";

export const metadata: Metadata = {
  title: "Zostań hostem",
};

export default async function BecomeHostPage() {
  const session = await getSession();
  if (!session) {
    redirect("/logowanie?next=/zostan-hostem");
  }

  const profile = await getBusinessProfile(session.userId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">
          Wynajmij swoje miejsce
        </h1>
        <p className="text-body text-muted">
          W dni meczowe pod Enea Stadionem brakuje miejsc, a Twoje stoi puste. Dodaj je —
          płatność trafia do Ciebie po wjeździe kierowcy.
        </p>
      </div>

      <HostForm
        defaultNip={profile?.nip ?? ""}
        defaultCompanyName={profile?.companyName ?? ""}
        defaultAddress={profile?.address ?? ""}
      />
    </div>
  );
}
