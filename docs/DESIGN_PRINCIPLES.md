# DESIGN_PRINCIPLES.md — ParkSpot

> Ten dokument jest wiążący. Każdy ekran, komponent i animacja musi dać się obronić którąś z poniższych zasad. Jeśli czegoś nie da się obronić — wyleć to.

---

## 0. Brief w jednym zdaniu

**ParkSpot to narzędzie, któremu ktoś powierza pieniądze i swój samochód, stojąc na deszczu pod stadionem z 40 tysiącami ludzi wokół.** Wszystko poniżej wynika z tego zdania.

Trzy konsekwencje, które przebijają każdą inną zasadę:
1. **Zaufanie > efektowność.** Interfejs, który wygląda na weekendowy side-project, nie dostanie 35 zł przelewem.
2. **Kciuk, jedna ręka, słabe światło, słaby zasięg.** To nie jest aplikacja przeglądana na 27-calowym monitorze przy kawie.
3. **Presja czasu.** Kierowca ma 8 minut do gwizdka. Każde zbędne kliknięcie to porzucony koszyk.

---

## 1. ANTY-SLOP: czego nie robimy nigdy

To jest lista rzeczy, które natychmiast zdradzają, że interfejs wygenerowała AI bez decyzji projektowej. **Żadna z nich nie może pojawić się w tym projekcie.**

**Kolor i tło**
- ❌ Kremowe tło (~`#F4F1EA`) + wysokokontrastowy serif + terakotowy akcent (~`#D97757`). To jest *domyślny* look, nie wybór.
- ❌ Czarne tło + jeden kwaśno-zielony/neonowy akcent.
- ❌ Fioletowo-różowe gradienty (`from-purple-500 to-pink-500`). Nigdy.
- ❌ Gradient na przycisku CTA, gradientowy tekst w nagłówku, gradientowa ramka.
- ❌ „Glassmorphism" — półprzezroczyste karty z `backdrop-blur` bez powodu.

**Układ i struktura**
- ❌ Hero z wielką liczbą, małą etykietką pod spodem i trzema statystykami obok. To szablon.
- ❌ Numerki `01 / 02 / 03` przy sekcjach, jeśli treść nie jest realną sekwencją.
- ❌ Trzy karty w rzędzie z ikonką, nagłówkiem i akapitem lorem ipsum.
- ❌ Sekcja „Trusted by" z wyszarzonymi logotypami firm, których nie mamy.
- ❌ Fałszywe liczby („10 000+ zadowolonych kierowców"), zanim będą prawdziwe.

**Typografia**
- ❌ Inter jako jedyny krój na wszystko. To domyślny wybór, nie decyzja.
- ❌ Wielkie, cienkie nagłówki (`font-light text-6xl`) bez powodu.

**Ikony i emoji**
- ❌ Emoji jako ikony w produkcyjnym UI (🚗 🅿️ ✨). Emoji to nie system ikon.
- ❌ Ikonka przy każdym elemencie listy „dla ozdoby".

**Animacje**
- ❌ Fade-in-up na każdej sekcji przy scrollu. To najbardziej rozpoznawalny tell AI-slopu.
- ❌ Animacje, które opóźniają dostęp do treści.
- ❌ Efekty parallax bez powodu.

**Copy**
- ❌ „Seamlessly", „Effortlessly", „Revolutionize", „Unlock", „Elevate".
- ❌ „Zrewolucjonizuj sposób, w jaki parkujesz." Nie. Napisz: „Zarezerwuj miejsce. Wjedź. Koniec."

---

## 2. Kierunek wizualny — do wyboru, nie do skopiowania

**Nie wybieraj żadnego z tych trzech automatycznie. Zaproponuj mi je, uzasadnij, i pozwól wybrać.** Każdy musi być wyprowadzony ze *świata parkowania*, nie z ogólnego „nowoczesnego SaaS-a".

### Kierunek A — „Oznakowanie drogowe"
Język wizualny znaków drogowych i oznaczeń poziomych: wysoki kontrast, płaskie plamy koloru, geometryczny grotesk, żółto-białe linie jako motyw graficzny. Ta estetyka **istnieje po to, żeby była czytelna z odległości, w deszczu, przy 60 km/h** — czyli dokładnie w warunkach naszego użytkownika. Ryzyko: może wyjść tanio, jeśli zostanie potraktowana dosłownie.

### Kierunek B — „Bilet / paragon"
Świat biletów parkingowych, kwitów, perforacji, monospace'owych numerów. Rezerwacja *jest* biletem — kod QR, numer, godzina. Ten kierunek pozwala zrobić z ekranu rezerwacji coś, co realnie wygląda jak przedmiot, a nie jak karta w Bootstrapie. Monospace do kodów i kwot (a nie do wszystkiego).

### Kierunek C — „Mapa jako podstawa"
Mapa nie jest sekcją — mapa jest tłem całej aplikacji, a UI to warstwa nad nią. Paleta wyprowadzona z kafelków mapy (stonowana), a akcent zarezerwowany **wyłącznie** dla pinezek i CTA. Najbardziej ryzykowny i najbardziej wyróżniający.

**Element sygnaturowy:** wybierz **jedną** rzecz, po której ta aplikacja będzie zapamiętana. Kandydat: **pinezka z ceną** (jak Airbnb, ale przemyślana pod nasz kontekst — pokazuje cenę, dystans pieszo i czy miejsce jest zadaszone, w jednym obiekcie o szerokości 60 px). Wydaj całą śmiałość tutaj. Reszta ma być cicha.

---

## 3. Typografia

- **Dwa kroje, nie jeden.** Krój wyświetlaniowy (nagłówki, ceny) + krój tekstowy (UI, opisy). Trzeci, monospace, wyłącznie do kodów rezerwacji i kwot.
- **Cyfry tabelaryczne (`font-variant-numeric: tabular-nums`) wszędzie, gdzie pokazujemy ceny, czasy i kody.** Ceny w liście parkingów muszą się wyrównywać w kolumnie. To jest szczegół, który odróżnia produkt od prototypu.
- Skala typograficzna: maksymalnie 6 poziomów. Jeśli potrzebujesz siódmego, źle zaprojektowałeś hierarchię.
- **Minimalny rozmiar tekstu w UI: 14px. Body: 16px.** Nikt nie czyta 12px stojąc na parkingu.

---

## 4. Kolor

- Paleta: **4–6 nazwanych wartości hex**, zdefiniowanych jako design tokeny. Nie więcej.
- **Akcent jest jeden i jest święty.** Używany wyłącznie do: głównego CTA, aktywnej pinezki, potwierdzenia sukcesu. Jeśli akcent jest wszędzie, nie znaczy nic.
- **Kolor nie jest jedynym nośnikiem informacji.** Status rezerwacji (ważna / zużyta / anulowana) musi być rozpoznawalny bez patrzenia na kolor — ikoną, etykietą, kształtem. 8% mężczyzn ma zaburzenia rozpoznawania barw, a to nasza grupa docelowa (kibice piłkarscy).
- Kontrast: **WCAG AA jako podłoga (4.5:1 dla tekstu), AAA dla ekranu skanera QR.** Host stoi przy bramie w słońcu i musi na 100% widzieć, czy ekran jest zielony czy czerwony.

---

## 5. Animacja — mniej, ale precyzyjnie

Zasada: **animacja ma komunikować przyczynę i skutek, nigdy nie ma być ozdobą.**

**Dozwolone i pożądane:**
- **Przejścia stanu** — przycisk → spinner → sukces. Użytkownik widzi, że jego kliknięcie coś zrobiło.
- **Zmiany layoutu** — panel wysuwający się z boku, bottom sheet podnoszący się z dołu. Animacja pokazuje, *skąd* element przyszedł i *gdzie* wróci.
- **Mikro-feedback dotyku** — subtelna zmiana skali (`scale: 0.97`) przy `:active` na mobile. Kompensuje brak fizycznego przycisku.
- **Płynne przejścia mapy** — `flyTo` przy wyborze eventu. To jest funkcjonalne: pokazuje ciągłość przestrzenną, użytkownik nie gubi orientacji.
- **Skeleton screens** zamiast spinnerów przy ładowaniu listy parkingów.

**Parametry:**
- Czas trwania: **150–250 ms** dla mikro-interakcji, **300–400 ms** dla przejść layoutu. Nic dłużej niż 400 ms — powyżej tego animacja przestaje być feedbackiem i zaczyna być czekaniem.
- Easing: `ease-out` dla wejść (szybki start, miękkie lądowanie), `ease-in` dla wyjść. Nigdy `linear` na ruchu.
- **`prefers-reduced-motion: reduce` respektowany bezwzględnie** — wtedy wszystko przełącza się natychmiast, bez ruchu.

**Zakazane:** animacje przy scrollu (poza mapą), animowane liczniki („0 → 1247 parkingów"), pulsujące CTA, cokolwiek co się rusza samo z siebie.

---

## 6. Zasady UX — twarde reguły

### 6.1. Widoczność statusu systemu (Nielsen #1)
Użytkownik zawsze wie, co się dzieje. Płatność przetwarza się → widzi to. Parking jest w moderacji → widzi to i wie, ile to potrwa. Cisza w interfejsie to najgorsza możliwa odpowiedź.

**Próg Doherty'ego:** każda akcja musi dać odpowiedź w **< 400 ms**. Jeśli operacja trwa dłużej — pokaż natychmiastowy feedback (skeleton, spinner, progress), zanim ona się skończy. Optymistyczne UI tam, gdzie to bezpieczne (toggle „udostępniam na event" ma zareagować natychmiast, a synchronizować w tle).

### 6.2. Zgodność z rzeczywistością
Nazywaj rzeczy tak, jak nazywa je użytkownik, nie system.
- ✅ „Wjazd od ul. Górczyńskiej" ❌ „entrance_location_note"
- ✅ „Twój kod: PK-7H2K" ❌ „Booking token"
- ✅ „Szlaban otwierany na kod" ❌ „accessType: BARRIER_CODE"

### 6.3. Kontrola i wyjście awaryjne
- **Każdy wieloetapowy formularz da się cofnąć bez utraty danych.** Dodawanie parkingu ma 20 pól — jeśli użytkownik zamknie kartę, ma wrócić do tego samego miejsca. Autosave do `DRAFT` po każdym kroku.
- Anulowanie rezerwacji jest widoczne, nieukryte i ma jasno opisane konsekwencje **zanim** użytkownik kliknie.

### 6.4. Zapobieganie błędom > komunikaty o błędach
- Walidacja **w trakcie pisania**, nie po submicie. NIP niepoprawny? Powiedz to przy 10. cyfrze, nie po kliknięciu „Zarejestruj".
- Nie da się zarezerwować miejsca w przeszłości → wyłącz te daty w kalendarzu, nie pokazuj błędu po fakcie.
- Auto ma 2,1 m, parking podziemny ma 1,9 m → **ukryj ten parking albo oznacz go wyraźnie**, nie pozwól kupić i dowiedzieć się przy szlabanie.

### 6.5. Rozpoznawanie zamiast przypominania
Kierowca nie ma pamiętać swojego kodu. Kod jest: w mailu, w SMS-ie, w aplikacji na ekranie głównym po zalogowaniu, i w Apple/Google Wallet (v2). **Aktywna rezerwacja jest pierwszą rzeczą, jaką widzi po otwarciu aplikacji.**

### 6.6. Prawo Fittsa (mobile)
- **Minimalny cel dotykowy: 44×44 px.** Bez wyjątków.
- **Główne akcje na dole ekranu**, w zasięgu kciuka. Nie w prawym górnym rogu, gdzie nikt nie dosięgnie jedną ręką.
- Akcje destrukcyjne (usuń, anuluj) **nie sąsiadują** z akcjami pozytywnymi.

### 6.7. Prawo Hicka
Im więcej opcji, tym dłużej trwa decyzja.
- Formularz dodawania parkingu ma **5 pól obowiązkowych na pierwszym ekranie**. Reszta to progresywne ujawnianie — „Dodaj więcej szczegółów (opcjonalnie)".
- Filtry mapy: **4 najważniejsze widoczne, reszta pod „Więcej filtrów"**.

### 6.8. Efekt pozycji szeregowej
Pierwsza i ostatnia pozycja na liście są zapamiętywane najlepiej. Najlepszy parking na górze, CTA na dole. Nie zakopuj najważniejszego w środku.

### 6.9. Stany puste to zaproszenie, nie martwy ekran
- Brak parkingów w promieniu eventu → **nie** „Brak wyników". Zamiast tego: *„Nie mamy jeszcze parkingów przy tym wydarzeniu. Masz miejsce w okolicy? Udostępnij je i zarób."* → CTA do rejestracji hosta. **Każdy pusty stan to szansa na pozyskanie podaży.**
- Host bez parkingów → pokaż mu, ile pieniędzy przeszło mu koło nosa: *„W promieniu 1 km od Ciebie w tym miesiącu odbędą się 4 wydarzenia."*

### 6.10. Błędy nie przepraszają
- ❌ „Ups! Coś poszło nie tak 😕"
- ✅ „Płatność nie przeszła. Środki nie zostały pobrane. Spróbuj ponownie albo użyj innej metody."
Powiedz **co się stało**, **czy to kosztowało pieniądze**, i **co zrobić dalej**. Zawsze w tej kolejności.

---

## 7. Krytyczne ścieżki — projektuj je pierwsze i najlepiej

Te trzy przepływy decydują o powodzeniu produktu. Reszta może być przeciętna. **Te nie mogą.**

### Ścieżka 1: Kupno miejsca (kierowca, 8 minut do gwizdka)
Cel: **od wejścia na stronę do kodu QR w maksymalnie 4 dotknięciach.**
Mapa → pinezka → „Zarezerwuj" → BLIK → kod. Bez zakładania konta przed zakupem (konto tworzy się *przy okazji* płatności, na podstawie maila i telefonu). Wymuszanie rejestracji przed zakupem zabije konwersję.

### Ścieżka 2: Skan kodu (host, przy bramie, 200 osób w kolejce, brak zasięgu)
- Ekran skanera to **jeden wielki widok kamery** i nic więcej. Zero menu, zero nawigacji.
- Odpowiedź: **pełnoekranowy zielony z ✓ i wielkim „WPUŚĆ"** albo **pełnoekranowy czerwony z powodem odrzucenia**. Czytelne z wyciągniętej ręki, w słońcu.
- **Wibracja przy skanie** (`navigator.vibrate`) — host patrzy na samochód, nie na telefon.
- **Zawsze widoczny przycisk „Wpisz kod ręcznie"** — kamery zawodzą, ekrany są brudne, telefony są stare.
- **Działa bez internetu.** Kody na dany event pobrane wcześniej do IndexedDB.

### Ścieżka 3: Udostępnienie parkingu na event (host, w domu, wieczorem)
Musi być **jednym kliknięciem** z maila. Link z maila → strona z jednym pytaniem („Udostępniasz parking na mecz Lech–Cracovia, 25.07?") → dwa przyciski: „Tak, 10 miejsc po 30 zł" / „Nie tym razem". Każde dodatkowe pole to spadek konwersji podaży.

---

## 8. Podłoga jakościowa — bez dyskusji

- Responsywność od **375 px** wzwyż.
- **Widoczny focus na klawiaturze** na każdym interaktywnym elemencie. Nie usuwaj `outline` bez zastąpienia go czymś lepszym.
- Semantyczny HTML. `<button>` to `<button>`, nie `<div onClick>`.
- Formularze: `<label>` powiązany z inputem, `autocomplete` ustawiony poprawnie (`tel`, `email`, `cc-number`).
- `prefers-reduced-motion` respektowany.
- Ekrany krytyczne (skaner, potwierdzenie płatności) przetestowane w **jasnym słońcu** i **jedną ręką**.
- **Zero layout shift** przy ładowaniu — rezerwuj miejsce na obrazy i mapę.

---

## 9. Copy — reguły pisania

- **Polski, sentence case, aktywny głos.** „Zarezerwuj miejsce", nie „Rezerwacja miejsca".
- **Nazwa akcji nie zmienia się w trakcie przepływu.** Przycisk „Zarezerwuj" → toast „Zarezerwowano" → mail „Twoja rezerwacja". Nie: „Zarezerwuj" → „Zakup zakończony" → „Potwierdzenie zamówienia".
- **Konkret zamiast sprytu.** „800 m pieszo od stadionu, 9 minut" bije „Blisko akcji!".
- **Każdy element robi jedną rzecz.** Etykieta etykietuje. Podpowiedź podpowiada. Nic nie robi dwóch rzeczy naraz.
- Kwoty zawsze z walutą i zawsze w tym samym formacie: `35 zł`, nie `35zł`, `35 PLN`, `35,00 zł` na przemian.

---

## 10. Proces pracy nad UI

1. **Zaproponuj plan designu przed kodem:** paleta (4–6 hex z nazwami), typografia (2–3 kroje z rolami), koncepcja layoutu (ASCII wireframe), element sygnaturowy.
2. **Skrytykuj własny plan:** przejdź listę z sekcji 1. Jeśli którykolwiek punkt pasuje — popraw i powiedz, co zmieniłeś.
3. **Dopiero potem koduj**, wyprowadzając każdy kolor i rozmiar z tokenów z planu.
4. **Rób zrzuty ekranu i patrz na nie.** Obrazek jest wart tysiąca tokenów.
5. **Przed oddaniem: usuń jeden element.** Zawsze jest jeden, który nie jest potrzebny.
