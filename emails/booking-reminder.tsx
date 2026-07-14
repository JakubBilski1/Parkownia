import { Text } from "@react-email/components";
import { formatDateTimePL } from "@/lib/format";
import {
  Cta,
  DetailRow,
  Layout,
  Panel,
  appUrl,
  font,
  mutedStyle,
  textStyle,
  token,
} from "./_shared";
import { entranceDirectionsUrl } from "./booking-confirmed";

export type BookingReminderProps = {
  firstName?: string | null;
  code: string;
  bookingId: string;
  parkingTitle: string;
  address: string;
  startsAt: string;
  entranceNotes?: string | null;
  entranceLat?: number | null;
  entranceLng?: number | null;
  accessInstructions?: string | null;
};

export default function BookingReminder({
  firstName,
  code,
  bookingId,
  parkingTitle,
  address,
  startsAt,
  entranceNotes,
  entranceLat,
  entranceLng,
  accessInstructions,
}: BookingReminderProps) {
  const bookingUrl = appUrl(`/rezerwacja/${bookingId}`);

  return (
    <Layout
      preview={`Za 2 godziny: ${parkingTitle}. Kod ${code}.`}
      heading="Za 2 godziny masz miejsce"
      footerNote="Przypomnienie o rezerwacji, którą opłaciłeś w ParkSpot."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}, o ` : "O "}
        {formatDateTimePL(startsAt)} zaczyna się Twoja rezerwacja. Kod poniżej pokaż przy wjeździe.
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
            margin: 0,
          }}
        >
          {code}
        </Text>
      </Panel>

      <DetailRow label="Parking" value={parkingTitle} />
      <DetailRow label="Adres" value={address} />
      {entranceNotes ? <DetailRow label="Wjazd" value={entranceNotes} /> : null}
      {accessInstructions ? (
        <DetailRow label="Jak wjechać na teren" value={accessInstructions} />
      ) : null}

      {entranceLat != null && entranceLng != null ? (
        <Cta href={entranceDirectionsUrl(entranceLat, entranceLng)} label="Nawiguj do wjazdu" />
      ) : (
        <Cta href={bookingUrl} label="Otwórz rezerwację" />
      )}
    </Layout>
  );
}

BookingReminder.PreviewProps = {
  firstName: "Marek",
  code: "PK-7H2K-4XQ9",
  bookingId: "b1f0c2a4-0000-0000-0000-000000000000",
  parkingTitle: "Plac firmowy przy Bułgarskiej",
  address: "ul. Bułgarska 17, Poznań",
  startsAt: "2026-07-25T17:00:00Z",
  entranceNotes: "Wjazd od ul. Górczyńskiej, brama nr 2",
  entranceLat: 52.3928,
  entranceLng: 16.8834,
  accessInstructions: "Szlaban otwierany na kod 4417.",
} satisfies BookingReminderProps;
