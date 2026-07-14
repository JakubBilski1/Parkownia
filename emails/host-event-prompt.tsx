import { Text } from "@react-email/components";
import { formatMoney, formatTimePL, formatWalkDistance } from "@/lib/format";
import {
  Cta,
  DetailRow,
  Layout,
  Panel,
  SecondaryLink,
  appUrl,
  formatEventDayPL,
  formatSpots,
  mutedStyle,
  textStyle,
} from "./_shared";

export type HostEventPromptProps = {
  firstName?: string | null;
  eventTitle: string;
  eventStartsAt: string;
  venueName: string;
  parkingTitle: string;
  /** Straight-line metres from the venue; formatWalkDistance hedges it with "ok.". */
  straightLineMeters: number;
  suggestedSpots: number;
  suggestedPriceGr: number;
  /** Net of commission, computed on the server. Never a guess made in the template. */
  estimatedPayoutGr: number;
  /** Single-use action token (purpose EVENT_AVAILABILITY) — works without logging in. */
  actionToken: string;
};

export default function HostEventPrompt({
  firstName,
  eventTitle,
  eventStartsAt,
  venueName,
  parkingTitle,
  straightLineMeters,
  suggestedSpots,
  suggestedPriceGr,
  estimatedPayoutGr,
  actionToken,
}: HostEventPromptProps) {
  const shareUrl = appUrl(`/udostepnij/${actionToken}`);

  return (
    <Layout
      preview={`${eventTitle}, ${formatEventDayPL(eventStartsAt)}. Z Twojego parkingu ${formatWalkDistance(straightLineMeters)}.`}
      heading="Twój parking stoi pusty"
      footerNote="Piszemy do Ciebie, bo masz w ParkSpot parking blisko tego wydarzenia. Jeden e-mail na wydarzenie, nie więcej."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}, w ` : "W "}
        {formatEventDayPL(eventStartsAt)} o {formatTimePL(eventStartsAt)} na obiekcie {venueName}{" "}
        odbywa się {eventTitle}. Z Twojego parkingu {parkingTitle} jest tam{" "}
        {formatWalkDistance(straightLineMeters)}. Tego dnia kierowcy będą krążyć w okolicy i
        szukać miejsca.
      </Text>

      <Panel>
        <DetailRow
          label="Proponujemy"
          value={`${formatSpots(suggestedSpots)} po ${formatMoney(suggestedPriceGr)}`}
        />
        <DetailRow label="Dostaniesz na konto" value={formatMoney(estimatedPayoutGr)} monospace />
        <Text style={{ ...mutedStyle, margin: 0 }}>
          Kwota po naszej prowizji, przy komplecie sprzedanych miejsc. Liczbę miejsc i cenę zmienisz
          na stronie.
        </Text>
      </Panel>

      <Cta href={shareUrl} label="Udostępnij miejsca" />

      <SecondaryLink href={`${shareUrl}?odpowiedz=nie`} label="Nie tym razem" />

      <Text style={{ ...mutedStyle, margin: 0 }}>
        Link działa bez logowania i tylko dla tego wydarzenia.
      </Text>
    </Layout>
  );
}

HostEventPrompt.PreviewProps = {
  firstName: "Anna",
  eventTitle: "Lech Poznań – Cracovia",
  eventStartsAt: "2026-07-25T17:00:00Z",
  venueName: "Enea Stadion",
  parkingTitle: "Podwórze przy Bułgarskiej 40",
  straightLineMeters: 615,
  suggestedSpots: 10,
  suggestedPriceGr: 3000,
  estimatedPayoutGr: 15000,
  actionToken: "9f2c1d7a5b3e4f60",
} satisfies HostEventPromptProps;
