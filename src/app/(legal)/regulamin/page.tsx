import type { Metadata } from "next";
import { EntityCard } from "../_components/entity-card";

export const metadata: Metadata = {
  title: "Regulamin",
  description:
    "Regulamin świadczenia usług drogą elektroniczną w serwisie Parkownia: rodzaj usług, warunki, reklamacje.",
  alternates: { canonical: "/regulamin" },
};

// TODO(legal): SZKIELET regulaminu (UŚUDE art. 8) obejmujący OBECNY zakres serwisu
// (strona informacyjna + formularz dla właścicieli). Część transakcyjna
// (rezerwacje, płatności, prowizja, odpowiedzialność, zwroty) czeka na decyzje
// biznesowe (MoR vs pośrednik) i MUSI zostać uzupełniona oraz zaudytowana przez
// radcę prawnego pod kątem rejestru klauzul niedozwolonych UOKiK — patrz
// docs/LEGAL_RESEARCH.md §2.4. Nie wpisujemy tu wymyślonych warunków handlowych.

const prose = [
  "[&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink",
  "[&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-body [&_p]:text-muted",
  "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:text-body [&_li]:text-muted",
  "[&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_strong]:text-ink",
].join(" ");

export default function TermsPage() {
  return (
    <article>
      <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">Regulamin</h1>
      <p className="mt-2 text-ui text-muted">Wersja z dnia 1 sierpnia 2026.</p>

      <EntityCard role="provider" />

      <div className={prose}>
        <h2>§1. Postanowienia ogólne</h2>
        <p>
          Niniejszy regulamin określa zasady świadczenia usług drogą elektroniczną w serwisie
          Parkownia, dostępnym pod adresem parkownia.com (dalej „Serwis”). Usługodawcą jest{" "}
          <strong>Jakub Bilski</strong> (osoba fizyczna), adres do doręczeń: ul. Krótka 10a, Mosina,
          kontakt: <a href="mailto:kontakt@parkownia.com">kontakt@parkownia.com</a>.
        </p>
        <p>
          Użytkownik to każda osoba korzystająca z Serwisu. Właściciel to osoba udostępniająca miejsce
          postojowe; Kierowca to osoba poszukująca miejsca. Korzystanie z Serwisu oznacza akceptację
          regulaminu.
        </p>

        <h2>§2. Rodzaj i zakres usług</h2>
        <p>W ramach Serwisu udostępniamy obecnie następujące usługi świadczone drogą elektroniczną:</p>
        <ul>
          <li>dostęp do treści informacyjnych Serwisu;</li>
          <li>
            formularz kontaktowy dla właścicieli miejsc, umożliwiający pozostawienie danych w celu
            nawiązania współpracy oraz orientacyjny kalkulator przychodu;
          </li>
          <li>
            przeglądanie mapy miejsc parkingowych i kalendarza wydarzeń — w celach informacyjnych,
            bez możliwości rezerwacji;
          </li>
          <li>
            zapis na listę oczekujących („Powiadom mnie”), czyli pozostawienie adresu e-mail, żeby
            otrzymać jedną wiadomość, gdy uruchomimy rezerwacje online.
          </li>
        </ul>
        <p>
          Funkcje transakcyjne (rezerwacja i opłacanie miejsc, rozliczenia z właścicielami) są w
          przygotowaniu i zostaną objęte odrębnymi lub uzupełnionymi postanowieniami przed ich
          uruchomieniem. Do czasu ich udostępnienia niniejszy regulamin nie reguluje sprzedaży ani
          płatności, a Serwis nie przyjmuje rezerwacji — próba jej złożenia kończy się komunikatem,
          że sprzedaż nie została uruchomiona. Do tego czasu nie dochodzi więc do zawarcia umowy
          sprzedaży ani do pobrania jakiejkolwiek płatności.
        </p>
        <p>
          <strong>Zasady odpowiedzialności za pojazd i za miejsce postojowe</strong> — w tym za
          uszkodzenie lub kradzież auta na terenie udostępnionym przez właściciela — nie są objęte
          niniejszym regulaminem. Ustalamy je indywidualnie, na piśmie, w rozmowie z każdym
          właścicielem przed udostępnieniem przez niego pierwszego miejsca, i obejmiemy je odrębnymi
          postanowieniami przed uruchomieniem rezerwacji. Jeśli chcesz poznać te warunki wcześniej,
          napisz na <a href="mailto:kontakt@parkownia.com">kontakt@parkownia.com</a>.
        </p>

        <h2>§3. Warunki techniczne</h2>
        <p>
          Do korzystania z Serwisu potrzebne są: urządzenie z dostępem do internetu, aktualna
          przeglądarka z włączoną obsługą JavaScript oraz plików cookies niezbędnych do działania
          Serwisu. Korzystanie z formularzy wymaga podania prawdziwych danych.
        </p>

        <h2>§4. Zawarcie i rozwiązanie umowy o usługę elektroniczną</h2>
        <p>
          Umowa o świadczenie usługi drogą elektroniczną zostaje zawarta z chwilą rozpoczęcia
          korzystania z danej usługi (np. wejścia na stronę lub wysłania formularza) i ma charakter
          jednorazowy albo trwa do czasu zaprzestania korzystania. Użytkownik może w każdej chwili
          zakończyć korzystanie z Serwisu.
        </p>

        <h2>§5. Zakaz dostarczania treści bezprawnych</h2>
        <p>
          Zabronione jest dostarczanie przez Użytkownika treści o charakterze bezprawnym, a także
          korzystanie z Serwisu w sposób zakłócający jego działanie lub naruszający prawa osób
          trzecich.
        </p>

        <h2>§6. Reklamacje</h2>
        <p>
          Reklamacje dotyczące usług elektronicznych można składać na adres{" "}
          <a href="mailto:kontakt@parkownia.com">kontakt@parkownia.com</a>. Reklamację rozpatrujemy
          niezwłocznie, nie później niż w terminie 14 dni od jej otrzymania, informując o wyniku na
          podany adres kontaktowy.
        </p>

        <h2>§7. Dane osobowe</h2>
        <p>
          Zasady przetwarzania danych osobowych opisuje{" "}
          <a href="/prywatnosc">Polityka prywatności</a>.
        </p>

        <h2>§8. Postanowienia końcowe</h2>
        <p>
          Regulamin może ulec zmianie; obowiązująca wersja jest publikowana w Serwisie wraz z datą. W
          sprawach nieuregulowanych zastosowanie ma prawo polskie.
        </p>
      </div>
    </article>
  );
}
