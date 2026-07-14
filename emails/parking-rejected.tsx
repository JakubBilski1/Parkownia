import { Text } from "@react-email/components";
import { Cta, Layout, Panel, appUrl, mutedStyle, textStyle } from "./_shared";

export type ParkingRejectedProps = {
  firstName?: string | null;
  parkingId: string;
  parkingTitle: string;
  /** Required by the API (422 without it) — a rejection without a reason is a dead end. */
  reason: string;
};

export default function ParkingRejected({
  firstName,
  parkingId,
  parkingTitle,
  reason,
}: ParkingRejectedProps) {
  return (
    <Layout
      preview={`Parking ${parkingTitle} nie przeszedł weryfikacji. Powód w środku.`}
      heading="Nie publikujemy tego parkingu"
      footerNote="Ten e-mail dostajesz, bo zgłosiłeś parking do ParkSpot."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}, sprawdziliśmy` : "Sprawdziliśmy"} {parkingTitle} i nie możemy go
        na razie pokazać kierowcom.
      </Text>

      <Panel>
        <Text style={{ ...mutedStyle, margin: "0 0 4px" }}>Powód</Text>
        <Text style={{ ...textStyle, margin: 0 }}>{reason}</Text>
      </Panel>

      <Text style={textStyle}>
        To nie jest decyzja ostateczna. Popraw zgłoszenie i wyślij je do nas jeszcze raz —
        sprawdzamy w ciągu 48 godzin.
      </Text>

      <Cta href={appUrl(`/panel/parkingi/${parkingId}`)} label="Popraw zgłoszenie" />
    </Layout>
  );
}

ParkingRejected.PreviewProps = {
  firstName: "Anna",
  parkingId: "a3d2c1b0-0000-0000-0000-000000000000",
  parkingTitle: "Podwórze przy Bułgarskiej 40",
  reason:
    "Zdjęcia nie pokazują wjazdu ani nawierzchni. Dodaj dwa zdjęcia: bramę od strony ulicy i cały plac.",
} satisfies ParkingRejectedProps;
