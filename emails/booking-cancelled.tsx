import { Text } from "@react-email/components";
import { formatDateTimePL, formatMoney } from "@/lib/format";
import { DetailRow, Layout, Panel, SecondaryLink, appUrl, mutedStyle, textStyle } from "./_shared";

export type BookingCancelledProps = {
  firstName?: string | null;
  code: string;
  parkingTitle: string;
  startsAt: string;
  priceGr: number;
  refundGr: number;
  /** Who pulled the trigger — the driver reads a different sentence than a host cancel. */
  cancelledBy: "DRIVER" | "HOST" | "ADMIN";
  /** Reason shown only when the driver did not cancel themselves. */
  reason?: string | null;
};

function whatHappened(cancelledBy: BookingCancelledProps["cancelledBy"], code: string): string {
  switch (cancelledBy) {
    case "DRIVER":
      return `Anulowałeś rezerwację ${code}.`;
    case "HOST":
      return `Właściciel parkingu wycofał miejsce, więc anulowaliśmy rezerwację ${code}.`;
    case "ADMIN":
      return `Anulowaliśmy rezerwację ${code}.`;
  }
}

export default function BookingCancelled({
  firstName,
  code,
  parkingTitle,
  startsAt,
  priceGr,
  refundGr,
  cancelledBy,
  reason,
}: BookingCancelledProps) {
  const full = refundGr >= priceGr;

  return (
    <Layout
      preview={
        refundGr > 0
          ? `Rezerwacja ${code} anulowana. Zwracamy ${formatMoney(refundGr)}.`
          : `Rezerwacja ${code} anulowana. Bez zwrotu.`
      }
      heading="Rezerwacja anulowana"
      footerNote="Ten e-mail dostajesz, bo Twoja rezerwacja w ParkSpot została anulowana."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}. ` : ""}
        {whatHappened(cancelledBy, code)} Miejsce na {parkingTitle} o {formatDateTimePL(startsAt)}{" "}
        nie jest już Twoje.
      </Text>

      {reason && cancelledBy !== "DRIVER" ? (
        <Text style={textStyle}>Powód: {reason}</Text>
      ) : null}

      <Panel>
        <DetailRow label="Zapłaciłeś" value={formatMoney(priceGr)} monospace />
        <DetailRow label="Zwracamy" value={formatMoney(refundGr)} monospace />
        <Text style={{ ...mutedStyle, margin: 0 }}>
          {refundGr === 0
            ? "Anulowanie na mniej niż 2 godziny przed startem nie daje zwrotu — tak działa polityka, którą zaakceptowałeś przy zakupie."
            : full
              ? "Pieniądze wracają tą samą drogą, którą przyszły (BLIK lub karta). Zwykle 1–3 dni robocze, maksymalnie 10."
              : "Zwrot częściowy wynika z polityki anulowania obowiązującej przy zakupie. Pieniądze wracają tą samą drogą, którą przyszły — zwykle 1–3 dni robocze, maksymalnie 10."}
        </Text>
      </Panel>

      {cancelledBy === "HOST" ? (
        <Text style={textStyle}>
          Zwrot to za mało, gdy zostajesz bez miejsca na godzinę przed meczem. Sprawdź, co jest
          wolne w okolicy.
        </Text>
      ) : null}

      <SecondaryLink href={appUrl("/mapa")} label="Znajdź inne miejsce" />
    </Layout>
  );
}

BookingCancelled.PreviewProps = {
  firstName: "Marek",
  code: "PK-7H2K-4XQ9",
  parkingTitle: "Plac firmowy przy Bułgarskiej",
  startsAt: "2026-07-25T17:00:00Z",
  priceGr: 3500,
  refundGr: 1750,
  cancelledBy: "DRIVER",
} satisfies BookingCancelledProps;
