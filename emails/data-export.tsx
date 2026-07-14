import { Text } from "@react-email/components";
import { formatDateTimePL } from "@/lib/format";
import { Cta, Layout, appUrl, mutedStyle, textStyle } from "./_shared";

export type DataExportProps = {
  firstName?: string | null;
  /** Single-use action token (purpose DATA_EXPORT), valid 24 h (docs/API_SPEC.md §10). */
  actionToken: string;
  expiresAt: string;
};

export default function DataExport({ firstName, actionToken, expiresAt }: DataExportProps) {
  const url = appUrl(`/konto/eksport/${actionToken}`);

  return (
    <Layout
      preview="Twoje dane z ParkSpot są gotowe do pobrania."
      heading="Twoje dane są gotowe"
      footerNote="Ten e-mail dostajesz, bo poprosiłeś o kopię swoich danych z ParkSpot."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}, przygotowaliśmy` : "Przygotowaliśmy"} plik JSON z Twoimi danymi:
        kontem, rezerwacjami, parkingami i zgodami.
      </Text>

      <Cta href={url} label="Pobierz swoje dane" />

      <Text style={{ ...mutedStyle, margin: "0 0 8px" }}>
        Link działa do {formatDateTimePL(expiresAt)} i tylko raz. Potem poproś o eksport ponownie.
      </Text>
      <Text style={{ ...mutedStyle, margin: 0 }}>
        Plik zawiera Twoje dane osobowe. Nie przesyłaj go dalej.
      </Text>
    </Layout>
  );
}

DataExport.PreviewProps = {
  firstName: "Marek",
  actionToken: "9f2c1d7a5b3e4f60",
  expiresAt: "2026-07-26T12:00:00Z",
} satisfies DataExportProps;
