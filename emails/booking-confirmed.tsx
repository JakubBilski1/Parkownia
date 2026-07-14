import { Img, Section, Text } from "@react-email/components";
import { formatDateTimePL, formatMoney } from "@/lib/format";
import {
  Cta,
  DetailRow,
  Layout,
  Panel,
  SecondaryLink,
  appUrl,
  font,
  formatSpots,
  mutedStyle,
  textStyle,
  token,
} from "./_shared";

export type BookingConfirmedProps = {
  firstName?: string | null;
  code: string;
  bookingId: string;
  parkingTitle: string;
  address: string;
  startsAt: string;
  endsAt: string;
  spots: number;
  priceGr: number;
  eventTitle?: string | null;
  entranceNotes?: string | null;
  entranceLat?: number | null;
  entranceLng?: number | null;
  /** Instructions are private until the booking is CONFIRMED (docs/API_SPEC.md §3). */
  accessInstructions?: string | null;
  /** Content-ID of the QR attachment; the code below works without it. */
  qrCid?: string;
};

export function entranceDirectionsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${lat}%2C${lng}`;
}

export default function BookingConfirmed({
  firstName,
  code,
  bookingId,
  parkingTitle,
  address,
  startsAt,
  endsAt,
  spots,
  priceGr,
  eventTitle,
  entranceNotes,
  entranceLat,
  entranceLng,
  accessInstructions,
  qrCid = "qr",
}: BookingConfirmedProps) {
  const bookingUrl = appUrl(`/rezerwacja/${bookingId}`);

  return (
    <Layout
      preview={`Twój kod: ${code}. ${parkingTitle}, ${formatDateTimePL(startsAt)}.`}
      heading="Twoja rezerwacja"
      footerNote="Ten e-mail dostajesz, bo zarezerwowałeś miejsce w ParkSpot."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}, masz` : "Masz"} opłacone miejsce
        {eventTitle ? ` na wydarzenie ${eventTitle}` : ""}. Pokaż ten kod przy wjeździe.
      </Text>

      <Panel>
        <Text style={{ ...mutedStyle, margin: "0 0 4px" }}>Twój kod</Text>
        <Text
          style={{
            color: token.ink,
            fontFamily: font.mono,
            fontSize: "28px",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            letterSpacing: "0.06em",
            lineHeight: "34px",
            margin: "0 0 16px",
          }}
        >
          {code}
        </Text>
        {qrCid ? (
          <Section>
            <Img
              src={`cid:${qrCid}`}
              alt={`Kod QR rezerwacji ${code}`}
              width={160}
              height={160}
              style={{ display: "block", margin: 0 }}
            />
          </Section>
        ) : null}
        <Text style={{ ...mutedStyle, margin: "12px 0 0" }}>
          Jeśli kod QR się nie wyświetla, podaj kod hostowi — wpisze go ręcznie.
        </Text>
      </Panel>

      <DetailRow label="Parking" value={parkingTitle} />
      <DetailRow label="Adres" value={address} />
      <DetailRow label="Od" value={formatDateTimePL(startsAt)} monospace />
      <DetailRow label="Do" value={formatDateTimePL(endsAt)} monospace />
      <DetailRow label="Miejsca" value={formatSpots(spots)} />
      <DetailRow label="Zapłacono" value={formatMoney(priceGr)} monospace />

      {entranceNotes ? <DetailRow label="Wjazd" value={entranceNotes} /> : null}
      {accessInstructions ? (
        <DetailRow label="Jak wjechać na teren" value={accessInstructions} />
      ) : null}

      <Text style={{ ...mutedStyle, margin: "20px 0 16px" }}>
        Wjazd bywa w innym miejscu niż sam parking. Nawiguj do wjazdu, nie do adresu.
      </Text>

      {entranceLat != null && entranceLng != null ? (
        <Cta href={entranceDirectionsUrl(entranceLat, entranceLng)} label="Nawiguj do wjazdu" />
      ) : (
        <Cta href={bookingUrl} label="Otwórz rezerwację" />
      )}

      <SecondaryLink href={bookingUrl} label="Rezerwacja, kod QR i anulowanie" />
    </Layout>
  );
}

BookingConfirmed.PreviewProps = {
  firstName: "Marek",
  code: "PK-7H2K-4XQ9",
  bookingId: "b1f0c2a4-0000-0000-0000-000000000000",
  parkingTitle: "Plac firmowy przy Bułgarskiej",
  address: "ul. Bułgarska 17, Poznań",
  startsAt: "2026-07-25T17:00:00Z",
  endsAt: "2026-07-25T22:30:00Z",
  spots: 1,
  priceGr: 3500,
  eventTitle: "Lech Poznań – Cracovia",
  entranceNotes: "Wjazd od ul. Górczyńskiej, brama nr 2",
  entranceLat: 52.3928,
  entranceLng: 16.8834,
  accessInstructions: "Szlaban otwierany na kod 4417. Zaparkuj na miejscach oznaczonych P.",
} satisfies BookingConfirmedProps;
