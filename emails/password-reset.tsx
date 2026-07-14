import { Text } from "@react-email/components";
import { Cta, Layout, appUrl, mutedStyle, textStyle } from "./_shared";

export type PasswordResetProps = {
  firstName?: string | null;
  /** Single-use action token (purpose PASSWORD_RESET). */
  actionToken: string;
  expiresInMinutes: number;
};

export default function PasswordReset({
  firstName,
  actionToken,
  expiresInMinutes,
}: PasswordResetProps) {
  const url = appUrl(`/haslo/reset/${actionToken}`);

  return (
    <Layout
      preview="Ustaw nowe hasło do ParkSpot."
      heading="Ustaw nowe hasło"
      footerNote="Ten e-mail dostajesz, bo ktoś poprosił o zmianę hasła do konta ParkSpot."
    >
      <Text style={textStyle}>
        {firstName ? `${firstName}, kliknij` : "Kliknij"} poniżej, żeby ustawić nowe hasło. Link
        działa {expiresInMinutes} minut i tylko raz.
      </Text>

      <Cta href={url} label="Ustaw nowe hasło" />

      <Text style={{ ...mutedStyle, margin: "0 0 8px" }}>
        Jeśli to nie Ty prosiłeś o zmianę — zignoruj tę wiadomość. Hasło pozostaje takie, jakie
        było, a link wygaśnie sam.
      </Text>
      <Text style={{ ...mutedStyle, margin: 0, wordBreak: "break-all" }}>
        Link nie działa? Wklej ten adres do przeglądarki: {url}
      </Text>
    </Layout>
  );
}

PasswordReset.PreviewProps = {
  firstName: "Marek",
  actionToken: "9f2c1d7a5b3e4f60",
  expiresInMinutes: 60,
} satisfies PasswordResetProps;
