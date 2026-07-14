import { Text } from "@react-email/components";
import { formatDateTimePL, formatMoney } from "@/lib/format";
import { Cta, DetailRow, Layout, Panel, appUrl, mutedStyle, textStyle } from "./_shared";

export type PaymentFailedProps = {
  firstName?: string | null;
  bookingId: string;
  parkingTitle: string;
  priceGr: number;
  /** True only when money actually left the account and a refund is on its way. */
  charged: boolean;
  /** The PENDING booking dies at this moment and the spot goes back on sale. */
  holdExpiresAt?: string | null;
};

export default function PaymentFailed({
  firstName,
  bookingId,
  parkingTitle,
  priceGr,
  charged,
  holdExpiresAt,
}: PaymentFailedProps) {
  const retryUrl = appUrl(`/rezerwacja/${bookingId}/platnosc`);

  return (
    <Layout
      preview={
        charged
          ? `Płatność nie doszła do skutku. Zwracamy ${formatMoney(priceGr)}.`
          : "Płatność nie przeszła. Środki nie zostały pobrane."
      }
      heading="Płatność nie przeszła"
      footerNote="Ten e-mail dostajesz, bo próbowałeś opłacić rezerwację w ParkSpot."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}, płatność` : "Płatność"} za miejsce na {parkingTitle} nie doszła
        do skutku.
      </Text>

      <Panel>
        <DetailRow label="Kwota" value={formatMoney(priceGr)} monospace />
        <Text style={{ ...textStyle, margin: 0 }}>
          {charged
            ? "Pieniądze zostały pobrane, ale miejsce w międzyczasie zajął ktoś inny. Zwracamy całą kwotę tą samą drogą, którą przyszła — zwykle 1–3 dni robocze, maksymalnie 10."
            : "Środki nie zostały pobrane. Na Twoim koncie nic się nie zmieniło."}
        </Text>
      </Panel>

      {charged ? (
        <>
          <Text style={textStyle}>Miejsce trzeba wybrać od nowa.</Text>
          <Cta href={appUrl("/mapa")} label="Znajdź inne miejsce" />
        </>
      ) : (
        <>
          <Text style={textStyle}>
            Trzymamy dla Ciebie miejsce
            {holdExpiresAt ? ` do ${formatDateTimePL(holdExpiresAt)}` : " jeszcze przez chwilę"}.
            Spróbuj ponownie — BLIK-iem albo kartą.
          </Text>
          <Cta href={retryUrl} label="Zapłać ponownie" />
          <Text style={{ ...mutedStyle, margin: 0 }}>
            Po tym czasie miejsce wraca do sprzedaży i rezerwacja przepada.
          </Text>
        </>
      )}
    </Layout>
  );
}

PaymentFailed.PreviewProps = {
  firstName: "Marek",
  bookingId: "b1f0c2a4-0000-0000-0000-000000000000",
  parkingTitle: "Plac firmowy przy Bułgarskiej",
  priceGr: 3500,
  charged: false,
  holdExpiresAt: "2026-07-25T12:15:00Z",
} satisfies PaymentFailedProps;
