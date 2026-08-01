import type { Metadata } from "next";
import { EntityCard } from "../_components/entity-card";

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
      <p className="mt-2 text-ui text-muted">Wersja z dnia 1 sierpnia 2026.</p>

      <EntityCard role="controller" />

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
            <strong>Lista oczekujących (kierowcy):</strong> e-mail, a także parking lub
            wydarzenie, które oglądałeś, gdy się zapisywałeś. Zapisujesz się sam, przyciskiem
            „Powiadom mnie”, dopóki nie uruchomiliśmy rezerwacji online. Cel: jedna wiadomość o
            starcie oraz informacja, w okolicy których obiektów jest realny popyt — podstawa:
            art. 6 ust. 1 lit. a RODO oraz odrębna zgoda z art. 398 Prawa komunikacji
            elektronicznej. Zgodę możesz w każdej chwili wycofać.
          </li>
          <li>
            <strong>Dane techniczne i bezpieczeństwo:</strong> adres IP oraz nagłówek przeglądarki
            (user-agent) przy wysyłaniu formularzy. Cel: limity zgłoszeń i ochrona serwisu przed
            nadużyciami — podstawa: art. 6 ust. 1 lit. f RODO. IP przechowujemy wyłącznie w oknie
            liczenia limitu (minuty) i nie budujemy z niego profili.
          </li>
          <li>
            <strong>Wiadomości, które wysyłamy:</strong> treść wysłanej wiadomości i lista
            adresatów, a także lista adresów wykluczonych z wysyłki. Cel: rozliczalność (art. 5
            ust. 2 RODO) i dowód, że wypisanie zostało uszanowane — podstawa: art. 6 ust. 1 lit. c
            oraz lit. f RODO.
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
            <strong>operator płatności (Stripe) — jeszcze nie działa.</strong> Rezerwacji online
            nie uruchomiliśmy (§2 Regulaminu), więc dziś nie przekazujemy Stripe’owi żadnych
            danych. Wymieniamy go, bo to operator, z którym startujemy: gdy płatności ruszą,
            będzie przetwarzał dane zakupu i będzie też odrębnym administratorem w zakresie
            przeciwdziałania oszustwom i obowiązków instytucji płatniczej. Zaktualizujemy wtedy tę
            politykę i podamy datę.
          </li>
        </ul>

        <h2>4. Przekazywanie poza Europejski Obszar Gospodarczy</h2>
        <p>
          <strong>Dziś nie przekazujemy Twoich danych poza EOG.</strong> Hosting i baza stoją w
          Niemczech, a płatności nie działają. Gdy uruchomimy rezerwacje online, część danych
          zakupu będzie trafiać do Stanów Zjednoczonych w związku z obsługą płatności — na
          podstawie decyzji adekwatności EU–US Data Privacy Framework lub standardowych klauzul
          umownych (art. 46 RODO). Kopię zabezpieczeń możesz uzyskać, pisząc na{" "}
          <a href="mailto:kontakt@parkownia.com">kontakt@parkownia.com</a>.
        </p>

        <h2>5. Jak długo przechowujemy dane</h2>
        <ul>
          <li>dane z formularza dla właścicieli — do 24 miesięcy od ostatniego kontaktu lub do wniesienia sprzeciwu;</li>
          <li>lista oczekujących — do wysłania wiadomości o starcie, nie dłużej niż 12 miesięcy, albo do wycofania zgody;</li>
          <li>dane marketingowe — do czasu wycofania zgody;</li>
          <li>historia wysyłek (treść i adresaci) — 24 miesiące, na wypadek pytania „co dokładnie do mnie napisaliście”;</li>
          <li>
            lista adresów wykluczonych z wysyłki — <strong>bezterminowo</strong>. To jedyny sposób,
            żeby po wypisaniu nie trafić do Ciebie ponownie; skasowanie tego wpisu działałoby
            przeciwko Tobie. Trzymamy w niej wyłącznie sam adres.
          </li>
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

        <h2>7. Pliki cookies i pamięć przeglądarki</h2>
        <p>
          Używamy wyłącznie plików cookies <strong>niezbędnych do działania serwisu</strong>. Zgodnie
          z art. 371 Prawa komunikacji elektronicznej zgoda nie jest wymagana dla przechowywania
          danych koniecznych do świadczenia usługi, o którą sam prosisz — dlatego{" "}
          <strong>nie wyświetlamy banera zgody</strong>. Poniżej pełna lista tego, co zapisujemy na
          Twoim urządzeniu:
        </p>
        <ul>
          <li>
            <strong>ps_access</strong> — token sesji po zalogowaniu. Wygasa po 15 minutach.
          </li>
          <li>
            <strong>ps_refresh</strong> — odnawia sesję, żebyś nie logował się co kwadrans. Wygasa
            po 7 dniach.
          </li>
          <li>
            <strong>ps_booking_grants</strong> — podpisana lista rezerwacji zrobionych w tej
            przeglądarce. To ona pozwala Ci wrócić do własnego kodu QR bez zakładania konta i
            jednocześnie nie pokazuje Ci rezerwacji nikogo innego. Wygasa po 30 dniach.
          </li>
        </ul>
        <p>
          Wszystkie trzy są <strong>httpOnly</strong> (skrypty na stronie nie mają do nich dostępu),
          mają <strong>SameSite=Lax</strong> i są przesyłane wyłącznie po HTTPS. Nie należą do
          nikogo poza nami — nie ma tu cookies firm trzecich.
        </p>
        <p>
          W pamięci przeglądarki (localStorage, IndexedDB) trzymamy dodatkowo: wybrany motyw jasny
          lub ciemny, a w panelu hosta — wybrane wydarzenie i parking w skanerze oraz pobrane kody
          rezerwacji, żeby skaner działał przy bramie bez zasięgu. Te dane nie opuszczają Twojego
          urządzenia.
        </p>
        <p>
          <strong>Nie stosujemy analityki, reklam ani narzędzi śledzących.</strong> Kroje pisma
          serwujemy z własnego serwera, więc otwarcie strony nie łączy się z Google.
        </p>
        <p>
          Dwa wyjątki, o których warto wiedzieć: mapa pobiera kafle z serwerów{" "}
          <strong>OpenStreetMap Foundation</strong>, a etykiety na mapie — czcionki z serwera{" "}
          <strong>MapLibre</strong>. Te podmioty widzą wtedy Twój adres IP i to, że pobierasz
          fragment mapy; nie zapisują u Ciebie żadnych plików i nie przekazujemy im żadnych danych z
          formularzy ani z konta.
        </p>
        <p>
          Cookies możesz w każdej chwili usunąć albo zablokować w ustawieniach przeglądarki. Pamiętaj
          jednak, że bez nich <strong>nie zalogujesz się</strong> i <strong>nie otworzysz swojego
          kodu wjazdu</strong> — to nie ograniczenie z naszej strony, a wprost sposób, w jaki te
          funkcje działają.
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
