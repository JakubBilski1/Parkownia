import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka prywatności",
  description:
    "Jak Parkownia przetwarza dane osobowe: administrator, cele i podstawy prawne, odbiorcy, okresy przechowywania i Twoje prawa.",
  alternates: { canonical: "/prywatnosc" },
};

// TODO(legal): treść oparta na docs/LEGAL_RESEARCH.md §2.1/§3 — fakty (administrator,
// procesorzy, prawa) są pewne, ale przed publikacją całość powinien zatwierdzić
// radca prawny (m.in. okresy retencji, podstawa transferu do USA, IOD).

const prose = [
  "[&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink",
  "[&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-body [&_p]:text-muted",
  "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:text-body [&_li]:text-muted",
  "[&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_strong]:text-ink",
].join(" ");

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">
        Polityka prywatności
      </h1>
      <p className="mt-2 text-ui text-muted">Wersja z dnia 1 lipca 2026.</p>

      <div className={prose}>
        <h2>1. Administrator danych</h2>
        <p>
          Administratorem Twoich danych osobowych jest <strong>Jakub Bilski</strong> (osoba
          fizyczna), adres do doręczeń: ul. Krótka 10a, Mosina. We wszystkich sprawach dotyczących
          danych możesz pisać na <a href="mailto:kontakt@parkownia.com">kontakt@parkownia.com</a>.
          Nie wyznaczyliśmy inspektora ochrony danych — kontakt w sprawach danych prowadzimy pod
          powyższym adresem e-mail.
        </p>

        <h2>2. Jakie dane i po co przetwarzamy</h2>
        <p>Zakres danych zależy od tego, jak korzystasz z serwisu:</p>
        <ul>
          <li>
            <strong>Właściciele miejsc (formularz „dla właścicieli”):</strong> imię, telefon, e-mail,
            adres i lokalizacja obiektu, liczba miejsc. Cel: kontakt i podjęcie działań przed
            zawarciem umowy o udostępnianie miejsc — podstawa: art. 6 ust. 1 lit. b RODO, a w
            zakresie budowy bazy podaży — art. 6 ust. 1 lit. f (prawnie uzasadniony interes).
          </li>
          <li>
            <strong>Kierowcy (konto i rezerwacje):</strong> e-mail, telefon, imię, dane rezerwacji.
            Cel: założenie konta i realizacja rezerwacji — podstawa: art. 6 ust. 1 lit. b RODO.
          </li>
          <li>
            <strong>Marketing (opcjonalny):</strong> e-mail lub telefon, jeśli wyrazisz na to zgodę.
            Podstawa: art. 6 ust. 1 lit. a RODO oraz odrębna zgoda z art. 398 Prawa komunikacji
            elektronicznej. Zgodę możesz w każdej chwili wycofać.
          </li>
          <li>
            <strong>Dochodzenie i obrona roszczeń:</strong> art. 6 ust. 1 lit. f RODO.
          </li>
        </ul>

        <h2>3. Komu przekazujemy dane</h2>
        <p>
          Korzystamy z zaufanych dostawców, którzy przetwarzają dane na nasze zlecenie lub jako
          odrębni administratorzy:
        </p>
        <ul>
          <li>dostawca hostingu i bazy danych (Hetzner Online GmbH, Niemcy — EOG);</li>
          <li>dostawca poczty transakcyjnej oraz bramka SMS (powiadomienia);</li>
          <li>
            dostawca geokodowania adresów — wysyłamy do niego wyłącznie sam ciąg adresu, bez Twoich
            danych kontaktowych;
          </li>
          <li>dostawca magazynu plików (zdjęcia obiektów);</li>
          <li>
            operator płatności (Stripe) — na etapie zakupu rezerwacji; działa też jako odrębny
            administrator w zakresie przeciwdziałania oszustwom i obowiązków instytucji płatniczej.
          </li>
        </ul>

        <h2>4. Przekazywanie poza Europejski Obszar Gospodarczy</h2>
        <p>
          Część danych (np. w związku z płatnościami przez Stripe) może być przekazywana do Stanów
          Zjednoczonych na podstawie decyzji adekwatności EU–US Data Privacy Framework lub
          standardowych klauzul umownych (art. 46 RODO). Kopię zabezpieczeń możesz uzyskać, pisząc na{" "}
          <a href="mailto:kontakt@parkownia.com">kontakt@parkownia.com</a>.
        </p>

        <h2>5. Jak długo przechowujemy dane</h2>
        <ul>
          <li>dane z formularza dla właścicieli — do 24 miesięcy od ostatniego kontaktu lub do wniesienia sprzeciwu;</li>
          <li>dane marketingowe — do czasu wycofania zgody;</li>
          <li>dane związane z umową i roszczeniami — do upływu terminów przedawnienia.</li>
        </ul>

        <h2>6. Twoje prawa</h2>
        <p>
          Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania,
          przenoszenia, wniesienia sprzeciwu (wobec przetwarzania opartego na prawnie uzasadnionym
          interesie) oraz cofnięcia zgody w dowolnym momencie (bez wpływu na zgodność z prawem
          przetwarzania sprzed cofnięcia). Przysługuje Ci też prawo wniesienia skargi do{" "}
          <strong>Prezesa Urzędu Ochrony Danych Osobowych</strong> (ul. Stawki 2, 00-193 Warszawa).
        </p>

        <h2>7. Pliki cookies</h2>
        <p>
          Używamy wyłącznie plików cookies niezbędnych do działania serwisu (m.in. utrzymanie sesji i
          zapamiętanie wybranego motywu). Nie stosujemy analityki ani narzędzi śledzących firm
          trzecich, dlatego nie wyświetlamy banera zgody na cookies.
        </p>

        <h2>8. Dobrowolność</h2>
        <p>
          Podanie danych jest dobrowolne, ale niezbędne do skontaktowania się z Tobą i nawiązania
          współpracy albo do korzystania z funkcji wymagających konta. Zgody marketingowe są w pełni
          dobrowolne i nie warunkują pozostałych usług.
        </p>

        <h2>9. Zmiany polityki</h2>
        <p>
          Politykę możemy aktualizować — obowiązująca wersja jest zawsze dostępna na tej stronie wraz
          z datą. O istotnych zmianach poinformujemy w serwisie.
        </p>
      </div>
    </article>
  );
}
