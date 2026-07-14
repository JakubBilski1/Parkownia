import { Text } from "@react-email/components";
import { formatDatePL, formatTimePL } from "@/lib/format";
import { Cta, Layout, Panel, appUrl, mutedStyle, textStyle } from "./_shared";

export type ParkingApprovedProps = {
  firstName?: string | null;
  parkingId: string;
  parkingTitle: string;
  /** Nearest event within the parking's radius, if there is one — this is the hook. */
  nextEvent?: { title: string; startsAt: string; venueName: string } | null;
};

export default function ParkingApproved({
  firstName,
  parkingId,
  parkingTitle,
  nextEvent,
}: ParkingApprovedProps) {
  return (
    <Layout
      preview={`${parkingTitle} jest już widoczny na mapie.`}
      heading="Twój parking jest na mapie"
      footerNote="Ten e-mail dostajesz, bo zgłosiłeś parking do ParkSpot."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}, sprawdziliśmy` : "Sprawdziliśmy"} {parkingTitle}. Od teraz
        kierowcy widzą go na mapie i mogą rezerwować miejsca.
      </Text>

      {nextEvent ? (
        <Panel>
          <Text style={{ ...textStyle, margin: "0 0 8px" }}>
            Najbliższa okazja: {nextEvent.title}, {formatDatePL(nextEvent.startsAt)} o{" "}
            {formatTimePL(nextEvent.startsAt)} na {nextEvent.venueName}.
          </Text>
          <Text style={{ ...mutedStyle, margin: 0 }}>
            Przypomnimy Ci o tym tydzień wcześniej. Możesz też od razu ustawić, ile miejsc
            udostępniasz.
          </Text>
        </Panel>
      ) : null}

      <Cta href={appUrl(`/panel/parkingi/${parkingId}`)} label="Ustaw dostępność" />

      <Text style={{ ...mutedStyle, margin: 0 }}>
        Pieniądze wypłacamy po rozliczeniu okresu. Zasady i prowizję znajdziesz w panelu.
      </Text>
    </Layout>
  );
}

ParkingApproved.PreviewProps = {
  firstName: "Anna",
  parkingId: "a3d2c1b0-0000-0000-0000-000000000000",
  parkingTitle: "Podwórze przy Bułgarskiej 40",
  nextEvent: {
    title: "Lech Poznań – Cracovia",
    startsAt: "2026-07-25T17:00:00Z",
    venueName: "Enea Stadion",
  },
} satisfies ParkingApprovedProps;
