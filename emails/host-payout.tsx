import { Text } from "@react-email/components";
import { formatDatePL, formatMoney } from "@/lib/format";
import { DetailRow, Layout, Panel, SecondaryLink, appUrl, mutedStyle, textStyle } from "./_shared";

export type HostPayoutProps = {
  firstName?: string | null;
  amountGr: number;
  bookingsCount: number;
  periodStart: string;
  periodEnd: string;
  /** Last four digits only — the full IBAN never leaves the database. */
  accountLast4?: string | null;
};

export default function HostPayout({
  firstName,
  amountGr,
  bookingsCount,
  periodStart,
  periodEnd,
  accountLast4,
}: HostPayoutProps) {
  return (
    <Layout
      preview={`Wypłata ${formatMoney(amountGr)} za ${formatDatePL(periodStart)} – ${formatDatePL(periodEnd)}.`}
      heading="Wysłaliśmy Ci wypłatę"
      footerNote="Ten e-mail dostajesz, bo udostępniasz parking w ParkSpot."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}, rozliczyliśmy` : "Rozliczyliśmy"} Twoje rezerwacje z okresu{" "}
        {formatDatePL(periodStart)} – {formatDatePL(periodEnd)}.
      </Text>

      <Panel>
        <DetailRow label="Kwota" value={formatMoney(amountGr)} monospace />
        <DetailRow
          label="Rezerwacje"
          value={bookingsCount === 1 ? "1 rezerwacja" : `${bookingsCount} rezerwacji`}
        />
        {accountLast4 ? (
          <DetailRow label="Konto" value={`•••• ${accountLast4}`} monospace />
        ) : null}
        <Text style={{ ...mutedStyle, margin: 0 }}>
          Kwota po naszej prowizji. Przelew idzie zwykle 1–2 dni robocze.
        </Text>
      </Panel>

      <SecondaryLink href={appUrl("/panel/zarobki")} label="Rozliczenie co do rezerwacji" />
    </Layout>
  );
}

HostPayout.PreviewProps = {
  firstName: "Anna",
  amountGr: 42000,
  bookingsCount: 14,
  periodStart: "2026-07-01T00:00:00Z",
  periodEnd: "2026-07-07T00:00:00Z",
  accountLast4: "4417",
} satisfies HostPayoutProps;
