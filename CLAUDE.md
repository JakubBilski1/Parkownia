# CLAUDE.md — Parkownia

Ten plik jest czytany na starcie każdej sesji. Trzymaj go krótkim i aktualnym.

---

## Czym jest ten projekt

Marketplace parkingowy. Agreguje niewykorzystaną podaż miejsc parkingowych (firmy po godzinach, osoby prywatne, komercyjni operatorzy) i sprzedaje rezerwacje kierowcom — ze szczególnym naciskiem na wydarzenia masowe w Poznaniu (mecze Lecha na Enea Stadionie, targi na MTP).

**Model przychodowy:** prowizja od transakcji. Od 2026-10-10 **25% dla wszystkich** (wcześniej 50% od osób prywatnych, 30% od firm). Stawka jest w `commission_rules` (seed) i w `COMMISSION_PCT` (`src/modules/leads/calc.ts`); zmieniasz jedno, zmień drugie.

**Kim jest użytkownik:** kierowca stojący na deszczu pod stadionem z telefonem w jednej ręce, 8 minut przed gwizdkiem. Projektuj wszystko dla niego.

---

## Dokumenty źródłowe (czytaj przed pracą)

- `docs/ARCHITECTURE.md` — architektura i decyzje technologiczne
- `docs/DATA_MODEL.md` — schemat bazy
- `docs/API_SPEC.md` — endpointy
- `docs/PAYMENTS.md` — flow płatności, split, prowizje
- `docs/DESIGN_PRINCIPLES.md` — **zasady designu i UX. Obowiązkowe przed dotknięciem czegokolwiek wizualnego.**
- `docs/DESIGN_SYSTEM.md` — tokeny i komponenty (szkielet — wypełni się po wyborze kierunku wizualnego)
- `docs/ROADMAP.md` — fazy wdrożenia
- `docs/RISKS.md` — ryzyka
- `docs/LEADS_ICP.md` — brief dla generatora leadów: kogo kwalifikować, kogo odrzucać,
  co ma być w rekordzie (pitch i kanały są w `src/modules/acquisition/segments.ts`)

---

## Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
- **Mapa:** MapLibre GL JS + OpenStreetMap (NIE Google Maps)
- **Baza:** PostgreSQL + **PostGIS** (zapytania geo na indeksie GiST, nigdy filtrowanie w JS)
- **ORM:** Drizzle
- **Auth:** własny JWT (access 15 min + refresh 7 dni w httpOnly cookie), Argon2id. **Nie NextAuth.**
- **Płatności:** patrz `docs/PAYMENTS.md` — decyzja podejmowana świadomie, nie domyślnie
- **Deployment:** Docker + Coolify na VPS (Hetzner CX33)
- **Testy:** Vitest (unit), Playwright (e2e ścieżek krytycznych)

---

## Konwencje

- **Kod, nazwy zmiennych, komentarze, commity: angielski. UI i copy: polski.**
- Walidacja Zod na wejściu **każdego** endpointu, po stronie serwera. Nigdy nie ufaj frontowi.
- **Ceny liczone wyłącznie na serwerze.** Kwota przysłana z frontu jest ignorowana.
- Kwoty w bazie: **grosze, jako integer.** Nigdy float na pieniądzach.
- Czas w bazie: **UTC, `timestamptz`.** Konwersja na `Europe/Warsaw` dopiero w warstwie prezentacji.
- Współrzędne: PostGIS `geography(Point, 4326)`, zawsze z indeksem GiST.
- Sekrety w `.env`, nigdy w repo. Utrzymuj aktualny `.env.example`.
- Nie loguj danych osobowych ani payloadów płatności do konsoli.

---

## Zasady pracy ze mną

- **Pytaj, zanim założysz.** Niejasne wymaganie = pytanie, nie zgadywanie.
- **Kwestionuj mnie.** Jeśli mój pomysł jest zły — powiedz to wprost i zaproponuj alternatywę. Nie chcę potakiwania.
- **Zatrzymuj się po każdej ukończonej fazie z ROADMAP.md** i czekaj na akceptację.
- Commituj małymi krokami, po każdym logicznym module.
- **Commituj I PUSHUJ po każdej zmianie — bez pytania o zgodę** (ustalone 2026-07-28). Push na `main`
  uruchamia deploy, więc po każdym pushu **poczekaj, aż wejdzie na produkcję, sprawdź to i zgłoś
  wynik**. Nie mów „gotowe" na podstawie samego pushu — dowodem jest odpowiedź z `parkownia.com`.
- **Nie rozdmuchuj scope'u.** Lista rzeczy, których świadomie NIE budujemy w MVP, jest w `docs/ROADMAP.md`. Trzymaj się jej.

---

## Rzeczy, o które łatwo się potknąć w tym projekcie

**Sprzedaż tego samego miejsca dwa razy.** Sprawdzanie dostępności i tworzenie rezerwacji muszą być w jednej transakcji z blokadą wiersza. To nie jest opcjonalne.

**Skaner QR bez internetu.** Przy 40 tys. ludzi pod stadionem sieć komórkowa pada. Kody na dany event muszą być pobrane do IndexedDB **zanim** event się zacznie, walidowane lokalnie, synchronizowane po odzyskaniu sieci. Bez tego host stoi przy bramie z kolejką 200 osób i martwą aplikacją.

**Wjazd nie jest tam, gdzie parking.** `entranceLocation` to osobny punkt geograficzny niż `location`. Nawigacja kierowcy prowadzi do wjazdu, nie do środka placu.

**Wysokość pojazdu.** Parking podziemny ma 1,9 m, SUV ma 2,1 m. Filtruj to *przed* sprzedażą, nie tłumacz po fakcie.

**Dystans pieszo ≠ dystans w linii prostej.** Nie pokazuj odległości euklidesowej jako „800 m pieszo". Albo policz routing pieszy, albo wyraźnie oznacz, że to w linii prostej.

**Webhooki płatności.** Weryfikuj podpis. Zapewnij idempotencję — ten sam webhook przyjdzie kilka razy.

**Dane osobowe.** RODO nie jest opcjonalne. Zgody przy rejestracji, eksport danych, usunięcie konta.

---

## Stan projektu

*(aktualizuj tę sekcję po każdej ukończonej fazie)*

- [x] Faza projektowa — komplet dokumentów w `docs/` (2026-07-13)
  - Design: motyw jasny „Bilet", ciemny „Zmierzch" — wybrany. Tokeny definiuje
    `src/app/globals.css`, `tailwind.config.ts` tylko mapuje je na klasy. Akcent to stemplowa
    czerwień w OBU motywach (`#8e2b2b` jasny / `#c93a3a` ciemny) — szampan jest wycofany.
- [x] Faza 0 — scaffolding (Next.js, Docker, Drizzle, seed)
- [x] Faza 1 — Auth + model parkingu + formularz + mapa
- [x] Faza 2 — Eventy + nakładka na mapę + deklaracja dostępności hosta
- [x] Faza 3 — Rezerwacje + płatności + QR + powiadomienia
- [x] Faza 4 — Panel hosta (skaner offline) + panel admina
- [ ] Faza 5 — Hardening, testy e2e, deployment ← **TU JESTEŚMY**

**Bramka jakości (stan na 2026-07-26, wszystko uruchomione, nie zadeklarowane):**

| | |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ |
| `npm run build` | ✅ (przechodzi też **bez żadnego `.env`** — od `36779b0`) |
| `npx vitest run --project unit` | ✅ 141/141 |
| `npm run test:integration` | ⛔ nieuruchomione — brak lokalnego PostGIS |
| `npm run test:e2e` | ⛔ nieuruchomione — brak lokalnego PostGIS |

**Zielona bramka nie łapie wszystkiego — i to nie jest teoria.** Zmiana akcentu w ciemnym
motywie pojechała na produkcję martwa: `tsc`, `lint`, `build` i 104 testy przeszły, bo **żaden
z nich nie patrzy na skomputowany CSS**. Błąd wyszedł dopiero po otwarciu strony w przeglądarce.
Jeśli ruszasz cokolwiek wizualnego — otwórz to i zobacz, zanim powiesz „gotowe".

**Baza LOKALNA nie odpowiada (stan 2026-07-26)** — nie ma `.env.local`, port 5433 zamknięty,
demon Dockera nie wstaje, a w WSL Ubuntu nie ma zainstalowanego Postgresa. Poniższy opis to
stan z 2026-07-16, do odtworzenia: PostgreSQL 16 + PostGIS 3.6 (WSL, `localhost:5433`). Migracje i seed wykonane z `SEED_DEV=1`: 26 tabel,
17 eventów (mecze Lecha + targi MTP), 20 parkingów, 4 konta testowe
(`admin@` / `host@` / `firma@` / `kierowca@parkspot.pl`, hasło `parkspot123`).
Ścieżka zakupu przejechana end-to-end na żywym serwerze: rezerwacja → intent → webhook →
CONFIRMED + kod + QR + instrukcje wjazdu. Skaner: WPUŚĆ → drugi skan tego samego kodu → odrzucony.

- [x] Strona `/konto` — zgody, eksport, usunięcie konta (**luka RODO zamknięta**)
- [x] **Landing wszedł na `/`, mapa kierowcy na `/mapa`** (`/dla-wlascicieli` już nie istnieje —
      świadomie bez przekierowania, nikt go nie dostał). API zostało pod `/api/dla-wlascicieli/*`.
- [x] **Samodzielna rejestracja wyłączona** — strony `/rejestracja` nie ma, a `POST
      /api/auth/register` wymaga sesji admina i **nie ustawia już ciasteczek** (inaczej admin
      zakładający konto wylogowywałby się do klienta). Zakup bez konta działa jak dotąd.
      **Wróci** — to jest jeden commit do odkręcenia.
- [x] **`/admin/klienci` + `/admin/klienci/[id]`** — CRUD klientów i ich kont pracowniczych,
      hasło tymczasowe pokazywane RAZ, miękkie usuwanie z anonimizacją. Model: `users.employer_id`
      + rola `HOST_EMPLOYEE`, `resolveHostId()` w `src/modules/host/identity.ts`. Pracownik widzi
      wyłącznie `/panel/skaner` i `/panel/rezerwacje` (middleware + shell + `requireHost`),
      i **nie może sam zostać hostem**.
- [x] `users.stripe_account_id` / `charges_enabled` / `payouts_enabled` + `@stripe/stripe-js`;
      publikacja parkingu zablokowana, dopóki host nie przejdzie KYC (tylko na `PAYMENT_PROVIDER=stripe`)
- [x] Testy integracyjne i e2e istnieją i przechodzą (ostatni raz uruchomione 2026-07-16)
- [x] Landing akwizycyjny `/dla-wlascicieli` + tabela `leads` + `/prywatnosc` i `/regulamin`
- [x] **Panel leadów `/admin/leady`** + kafelek „Nowe leady" na pulpicie + alert e-mail na
      `LEAD_ALERT_EMAIL` przy każdym zgłoszeniu. **Szablon `owner-lead` stoi w pbdevs od 2026-10-11**
      (źródło `docs/mail-templates/owner-lead.mjml`, temat `{{subject}}`). **Działa na prodzie
      end-to-end od 2026-10-11:** testowy lead wysłany na `POST /api/dla-wlascicieli/leads` (201)
      → w logu pbdevs `SMTP accepted` do `kontakt@parkownia.com`, 1 próba, diakrytyka w temacie cała
- [x] **`/admin/akwizycja` — research podaży pod Eneą i MTP** (2026-08-11). 73 zmapowane place
      (6462 miejsca, z czego **3998 już płatnych** — APCOA stoi przy samej Enei, Grupa MTP ma swoje,
      więc do zdobycia jest 2464), 34 właścicieli bez zmapowanego placu i 12 ulic zabudowy
      mieszkaniowej. Do tego playbook per segment (pitch, decydent, cykl, ryzyko, legalny kanał)
      i **analiza prowizji**: 50/30 jest odwrócone — wyższa stawka trafia w segment z LEPSZĄ
      alternatywą (karton i gotówka), bo firma alternatywy nie ma. Propozycja 30/25 + kohorta
      założycielska 20%; mechanizm już istnieje (nadpisania `USER` w `commission_rules`, bez migracji).
      **Dane są SNAPSHOTEM OSM w repo, nie tabelą** — celowo, patrz mina niżej.

## PRODUKCJA ŻYJE (zweryfikowane 2026-07-16)

**`https://parkownia.com` stoi i serwuje tę aplikację.** Hetzner, `135.181.253.104`.
`parkownia.pl` **nie istnieje** (NXDOMAIN na 1.1.1.1 i 8.8.8.8) — nie szukaj tam niczego.

**Mina rozbrojona 2026-07-26: DEPLOY WRACAŁ NA STARY OBRAZ Z POWODU MIGRACJI, NIE BUILDU.**
Od `4acff5e` (tabela `leads`) każdy deploy Coolify budował się poprawnie, startował kontener,
padał w `docker-entrypoint` na `node scripts/migrate.mjs` i był rolowany z powrotem —
przez **pięć dni**, bez śladu w repo. Prod stał dokładnie na commicie sprzed migracji `0003`.

Przyczyna: `geographyPoint` (`src/db/geo.ts`) podaje typ SQL jako `geography(Point,4326)`.
Starsza drizzle-kit wypisywała to dosłownie (migracja `0000`:
`"location" geography(Point,4326)`), nowsza zaczęła **cytować nazwy typów własnych**
i w `0003` wyszło `"location" "geography(Point,4326)"`. W cudzysyłkach to jeden identyfikator,
więc Postgres szuka typu o NAZWIE `geography(Point,4326)` i odpowiada `42704: type does not
exist`. `"citext"` w cudzysyłkach działa (zwykła nazwa się rozwiązuje) — łamie się **wyłącznie
typ z parametrami**. Naprawione w `0003`; pilnuje tego `tests/unit/db/migrations.test.ts`.

**Wniosek na przyszłość: zielona bramka lokalna nie widzi wygenerowanego SQL.** `tsc`, `lint`,
`build` i wszystkie unity przechodziły, a produkcja nie wstawała. Po każdym `npm run db:generate`
**przeczytaj plik `.sql`**, który wypadł, i sprawdź go na żywej bazie, zanim pushniesz.

**Druga mina w tej samej maszynerii: drizzle puszcza WSZYSTKIE zaległe migracje w JEDNEJ
transakcji** (`session.transaction(...)` w `node_modules/drizzle-orm/pg-core/dialect.js`).
Postgres pozwala na `ALTER TYPE … ADD VALUE` w transakcji, ale **zabrania użycia nowej wartości
w tej samej transakcji**. Migracja `0004` dodaje `HOST_EMPLOYEE` i jej nie używa — celowo.
Jeśli kiedyś napiszesz migrację, która wstawia albo porównuje świeżo dodaną wartość enuma,
przejdzie na bazie, która wartość już ma, a padnie na świeżej, gdzie obie migracje są zaległe
razem. Pilnuje tego `tests/unit/db/migrations.test.ts`.
**Zanim uznasz, że cokolwiek „jest na produkcji" — sprawdź
`curl -o /dev/null -w "%{http_code}" https://parkownia.com/<ścieżka>`.**

Przy okazji naprawione `36779b0`: `src/db/index.ts` łączył się przy imporcie, więc `next build`
bez `DATABASE_URL` padał na „collect page data". To **nie** był powód blokady deployu (build
w Coolify przechodził), ale `docker build` bez środowiska teraz też działa.

**Push na `main` = deploy. Bez pytania.** Coolify ma własny webhook i sam przebudowuje;
**wchodzi ~8 minut po pushu** — o ile ścieżka deploymentu działa, patrz ostrzeżenie wyżej. W repo nie ma po tym ANI ŚLADU — brak `.github/workflows`,
domena nie występuje w kodzie. Nie wyciągaj z tego wniosku „push nie deployuje" (ja wyciągnąłem,
błędnie). Jak chcesz sprawdzić, czy zmiana weszła: porównaj hash bundla CSS z
`/_next/static/css/…` przed i po, i **daj mu te 8 minut**, zanim uznasz, że nie poszło.

**Coolify buduje przez nasz `Dockerfile`** — potwierdzone logiem deployu z 2026-07-26:
`docker compose --build` na `/artifacts/<id>/docker-compose.yaml`, healthcheck „found in
Dockerfile", po niepowodzeniu automatyczny rollback na poprzedni kontener. Build w Coolify
przechodzi (kontener startuje), więc środowisko builda ma to, czego potrzebuje. `docker build`
nigdy nie przeszedł na maszynie deweloperskiej (demon nie wstaje, `com.docker.service`
zatrzymana, brak uprawnień) — dlatego migracja pojechała nieprzetestowana w kontenerze.

**Landing JEST na produkcji (zweryfikowane 2026-07-26, po naprawie migracji).** `/dla-wlascicieli`,
`/prywatnosc`, `/regulamin` → 200. Kalkulator liczy realnymi danymi: punkt 302 m od Enei daje
`walkMinutes: 5`, `inReach: true`, **8 meczów Lecha** w 12 miesiącach i pas stawek 40–70 zł.
Geokoder odpowiada. `POST /api/dla-wlascicieli/leads` → **201**, więc zapis leada, przeliczenie
szacunku po stronie serwera i tabela `leads` działają na żywym PostGIS. W bazie siedzą dwa
wiersze testowe: `source = 'test-techniczny-2026-07-26'` (`REJECTED`, ten z krzakami zamiast
polskich znaków) i `source = 'test-utf8-2026-07-26'` (`NEW`) — oba do usunięcia.

**Uwaga: powyżej ~920 m w linii prostej kalkulator nie pokazuje ŻADNEJ kwoty** (`inReach: false`,
`events: 0`, `rate: null`) — pasy sięgają 15 minut. Adresaci maili dobierani dalej niż kilometr
od bramy zobaczą stronę bez liczby.

**Panel klientów i pracowników NIE BYŁ przeklikany** (stan 2026-07-28). Migracja `0004` **jest**
na prodzie (patrz tabela niżej), ale nikt tą ścieżką nie przeszedł: brak lokalnego PostGIS, więc
`/admin/klienci`, hasła tymczasowe i ścieżka skanera dla
pracownika przeszły tylko `tsc`, `lint`, `build` i testy jednostkowe. Pierwsze uruchomienie na
prodzie jest jednocześnie pierwszym testem — sprawdź w tej kolejności: logowanie na konto z rolą
ADMIN (jest, patrz niżej) →
`/admin/klienci` → „Dodaj klienta" (hasło pokazuje się raz) → logowanie na to konto →
„Dodaj pracownika" → logowanie pracownika → `/panel/skaner` widzi parkingi KLIENTA, a `/panel/parkingi`
odbija na skaner.

**Baza produkcyjna da się obejrzeć bez lokalnego Postgresa — i to jest jedyny sposób, jaki
dziś działa.** Coolify → **Terminal** (lewy pasek) → z listy wybierz kontener
`localhost -> eob2glq2ngyo9lcyxu98kxfg` (to jest `pbdevs-postgis`) → `psql -U postgres -d parkownia`.
Port `5432`/`5433` na `135.181.253.104` jest zamknięty z zewnątrz, więc lokalny dev **nie ma jak**
się z tą bazą połączyć bez tunelu SSH albo wystawienia portu — celowo nie zrobiono ani jednego.

**Zawartość proda — zweryfikowana `psql`-em 2026-07-28** (poprzednie zapisy w tym pliku mówiły
co innego i były nieaktualne):

| tabela | stan |
|---|---|
| migracje | `0000`–`0005`, **wszystkie zaaplikowane** (ostatnia 2026-07-26 02:59 UTC) |
| `users` | 1 — `kubabilski8@gmail.com`, role `DRIVER` + `HOST_INDIVIDUAL` + **`ADMIN`** |
| `parkings` | 1 — „Mój dom", Racławicka 83, 5 miejsc, `ALWAYS`, 30 zł/event, status **`REJECTED`** |
| `events` / `venues` | 25 / 2 — Enea Stadion 13 (25.07.2026–21.01.2027, z Ligą Europy), MTP 12 (08.09.2026–20.06.2027). Stan po `161032b` (2026-10-10), sprawdzony przez `/wydarzenia` i `/api/dla-wlascicieli/potencjal`, nie `psql`. Wiosenne mecze Ekstraklasy dopiero po ogłoszeniu dat; zmieniając datę w seedzie, dopisz stary termin do `RESCHEDULED` |
| `event_parking_availability` | 0 |
| `leads` | 3, wszystkie testowe — trzeci to `source = 'test-alertu-2026-10-11'` (2026-10-11, test alertu e-mail) |
| `bookings` / `payments` | 0 / 0 |

**Konto z rolą ADMIN na prodzie ISTNIEJE**, więc `/admin/*` i `/admin/leady` są dostępne po
zalogowaniu na `kubabilski8@gmail.com`. (Historycznie: `admin@parkspot.pl` z `src/db/seed.ts`
siedzi za `SEED_DEV=1`, którego `docker-entrypoint.sh` nie ustawia, a aplikacja nie daje ścieżki
do samodzielnego nadania roli. Kolejne role nadaje się ręcznie:
`INSERT INTO user_roles (user_id, role) SELECT id, 'ADMIN' FROM users WHERE email = '…'
ON CONFLICT DO NOTHING;`. Rola czytana jest z bazy przy każdym żądaniu
— `modules/admin/session.ts` — więc działa bez wylogowania.)

**Mapa na prodzie jest pusta, mimo że parking już tam jest.** Jedyny wiersz w `parkings` ma
status `REJECTED`, więc nie wchodzi do wyników. `docker-entrypoint.sh` celowo nie ustawia
`SEED_DEV`, więc poza tym prod dostaje wyłącznie dane referencyjne: prowizje, politykę zwrotów,
obiekty i eventy. **To nie jest awaria** — to brak zaakceptowanej podaży.

## Audyt produkcji 2026-07-28/29 — stan mailingu

**Od 2026-10-11 PRODUKCJA WYSYŁA PRZEZ PBDEVS — ALE DZIAŁA TYLKO ALERT O LEADZIE.** W Coolify
(aplikacja `parkownia`, Production) są `EMAIL_PROVIDER=pbdevs`, `MAIL_API_KEY` (tylko runtime,
niedostępny przy buildzie) i `LEAD_ALERT_EMAIL=kontakt@parkownia.com`. Do tego dnia był tryb
`console`: wysyłka „udawała się", a treść lądowała w logu kontenera. Teraz każdy szablon, którego
nie ma w pbdevs, dostaje 404 — **kod wjazdu po rezerwacji, reset hasła, powiadomienia o moderacji
i kampania nie dochodzą**, tyle że zamiast logu jest nieudana wysyłka. Do zrobienia: 10 szablonów
z `templates.ts` i `owner-campaign` (źródło `docs/mail-templates/owner-campaign.mjml`, temat
`{{subject}}`). **Nie zdejmuj `MAIL_API_KEY`, zostawiając `EMAIL_PROVIDER=pbdevs`:**
`getEmailProvider()` wtedy rzuca, a `sendNotification` tego nie łapie, więc reset hasła i maile
rezerwacji skończą się 500 (alert o leadzie łapie, `notify.ts`).

**Stan pbdevs (2026-10-11):** w `mail.pbdevs.com` istnieje aplikacja `parkownia` (from „Parkownia",
Reply-To `kontakt@parkownia.com`, 20/h, 100/dzień, burst 2/s) z jednym szablonem: `owner-lead`.
Klucz API (`mk_live_…`, pokazywany raz) wygenerował właściciel i wkleił prosto do Coolify — nie
ma go w czacie ani w repo; nowy generuje się w `/apps/parkownia`.
**Każda poczta z pbdevs wychodzi z `support@pbdevs.com`** (wspólna skrzynka SMTP, Reply-To
per aplikacja), więc braki DNS `parkownia.com` opisane niżej nie blokują maili z aplikacji —
dotyczą tylko poczty wysyłanej ręcznie z `kontakt@`. Kampania przez pbdevs idzie na reputacji
domeny `pbdevs.com`, wspólnej dla 13 innych aplikacji.

**pbdevs odrzuca CAŁĄ wysyłkę (422 `missing_variables`), gdy którakolwiek zmienna z szablonu
przyjdzie jako `null`** — a za wymaganą uznaje każdą nazwę w `{{ }}`, także w `{{#if x}}`
i w komentarzu HTML. Payloady wysyłają `""` zamiast `null` (tak robi `templates.ts`; `notify.ts`
do 2026-10-11 tego nie robił i alert padałby przy każdym leadzie bez telefonu albo bez MTP
w zasięgu). `tests/unit/leads/notify.test.ts` czyta `owner-lead.mjml` i pilnuje tej zgodności.

**DNS pod wysyłkę jest niekompletny** (sprawdzone `Resolve-DnsName` przez 1.1.1.1):
`SPF = v=spf1 include:spf.spacemail.com ~all` (autoryzuje wyłącznie spacemail), DKIM tylko
`spacemail._domainkey`, a **DMARC nie istnieje**. Gmail i Yahoo wymagają DMARC od masowych
nadawców — bez tego wysyłka masowa nie dociera.

**Aplikacja nazywa 12 szablonów, w repo są 2** (`owner-campaign.mjml`, `owner-lead.mjml`). Pozostałe muszą
istnieć po stronie `mail.pbdevs.com`; brakujący szablon = 404 z serwisu i **cicha** nieudana
wysyłka (patrz komentarz w `modules/notifications/email.ts`).

**Wypisanie z kampanii to `mailto:`**, nie ma nagłówka `List-Unsubscribe` ani tabeli wykluczeń
w bazie — po wypisaniu nic nie blokuje ponownej wysyłki.

**`docs/LEGAL_RESEARCH.md` zakazuje cold-mailingu** („Zero cold-mailingu/cold-SMS do
właścicieli", art. 398 PKE obejmuje też B2B). Panel „Mailing" i landing są zbudowane pod
akwizycję — ta sprzeczność jest decyzją właściciela, nie usterką do naprawienia w kodzie.

**Zweryfikowane jako świadomy projekt, nie dziura:** `/moje-rezerwacje` odpowiada 200 bez
logowania, bo zakup bez konta jest celowy — gość dostaje podpisane ciasteczko
`ps_booking_grants` (`modules/bookings/session.ts`) z prawem odczytu i anulowania **wyłącznie**
własnych rezerwacji.

**Co NIE jest zrobione — nie udawaj, że jest:**

- [x] **`PATCH /api/me` + edytowalne „Moje dane" na `/konto`** — imię, nazwisko i telefon poprawia
      sam użytkownik (RODO art. 16; strona miała dotąd tylko eksport i usunięcie konta). Wysyłane
      są **wyłącznie zmienione pola**: `undefined` = nie ruszaj, `null` = wyczyść. Zweryfikowane
      w przeglądarce na tymczasowej stronie podglądu (walidacja numeru, blokada zapisu, toast
      błędu); **ścieżka sukcesu nie była uruchomiona — wymaga bazy.** Testy integracyjne są
      w `tests/integration/profile-rectification.test.ts` i czekają na PostGIS.
- [ ] **`PAYMENT_PROVIDER` nieuzupełniony przez właściciela** — bez tego nic się nie kupi.
      Uwaga: brama KYC (publikacja parkingu zablokowana do przejścia weryfikacji) odpala się
      **tylko** na `PAYMENT_PROVIDER=stripe`, więc dziś nie działa.
- [ ] Stripe przetestowany wyłącznie na mocku — brak testu na prawdziwym koncie testowym Stripe.
- [ ] **Trzeci kafelek w sekcji „Skala" na landingu** — średnia frekwencja Lecha / footfall MTP.
      Wycięty (`72e300b`), bo pusta ramka „do uzupełnienia" czytała się jak niedokończony produkt.
      Wraca dopiero z liczbą, którą da się wskazać źródłem.
- [ ] **Lokalna baza NIE ŻYJE** (stan 2026-07-26): brak `.env.local`, Postgres na 5433 nie
      odpowiada, Docker demon nie wstaje, w WSL Ubuntu nie ma Postgresa. Bez bazy nie da się
      uruchomić testów integracyjnych, e2e ani zobaczyć panelu admina i hosta.
- [ ] **Seed nie zawiera ani jednej deklaracji hosta na event** (`event_parking_availability` = 0 wierszy).
      Sprzedaż eventowa działa (parking z `availability_mode` pokrywającym okno sprzedaje się bez
      deklaracji), ale panel hosta „Wydarzenia", quick-declare z maila i skaner są po seedzie puste.
      Dotyczy dev-a; na prodzie i tak nie ma parkingów.

---

## Miny, w które ktoś już wdepnął — nie powtarzaj

**Ciemna paleta w `globals.css` jest zapisana DWA RAZY** — raz dla jawnego przełącznika
(`:root[data-theme="dark"]`), raz dla preferencji systemu (`@media (prefers-color-scheme: dark)`).
CSS nie umie dzielić jednej reguły przez granicę media query, więc duplikat jest konieczny.
**Zmieniasz token w jednej kopii → zmień w obu.** Kopia systemowa MUSI mieć selektor
`:root:not([data-theme])`; wariant `:not([data-theme="light"])` łapie się także na
`data-theme="dark"`, remisuje na specyficzności `(0,2,0)` i po cichu nadpisuje świadomy wybór
użytkownika. Dokładnie to pojechało na prod: każdy z ciemnym systemem widział stary akcent,
niezależnie od tego, co wybrał. Pilnuje tego teraz `tests/unit/design/theme-tokens.test.ts` —
rozjazd wywala build.

**`PageContainer` NIE jest do wszystkiego** (`src/components/ui/page-container.tsx`).
Ma dwa warianty, `prose` i `wide`, i jest świadomie użyty tylko na 4 stronach
(`/wydarzenia`, `/wydarzenia/[slug]`, `/konto`, `/panel/parkingi`). Reszta jest wąska **celowo**:
długie formularze, magic-link, wizjer skanera, 404, kolumna logowania; mapa i admin są full-bleed
pod swoimi shellami. **Poszerzenie płaci się tylko wtedy, gdy treść potrafi wydać to miejsce** —
jednokolumnowa lista kart rozciągnięta do 1152px to regres. Jeśli poszerzasz, zmień też siatkę
w środku (tak zrobiono na `/panel/parkingi`: `wide` + `lg:grid-cols-2`). Warianty `default`
i `full` zostały wycięte jako spekulacja — nie dodawaj ich z powrotem „na zapas".

**Powierzchnia budynku NIE JEST powierzchnią parkingu.** Pierwsze podejście do researchu
w `/admin/akwizycja` liczyło pojemność z obrysów budynków i landuse'ów — wyszło „4278 miejsc"
na boisku piłkarskim i „4452" na terenie samego MTP, czyli na obiekcie, który jest POPYTEM,
nie podażą. Jednostką analizy jest wyłącznie poligon `amenity=parking`; budynki i POI wokół służą
tylko do ustalenia, **czyj** jest plac (to napędza approach). Jeśli kiedyś regenerujesz dataset:
place bez zmapowanego parkingu trafiają na listę rekonesansu **bez żadnej liczby miejsc**, bo
zmyślona pojemność jest gorsza niż jej brak. Drugi wniosek z tych samych danych: **OSM prawie nie
mapuje prywatnych placów**, więc salony, parafie i podwórza spółdzielni z tej listy wypadają —
a to najlepiej konwertujące segmenty. Lista z OSM jest startem, nie rynkiem.

**Dataset akwizycji jest w repo, nie w bazie — świadomie.** `src/modules/acquisition/dataset.ts`
to snapshot, nie feed. Powody: migracje są w tym projekcie najdroższym trybem awarii (patrz
`geography(Point,4326)` wyżej), nie ma lokalnego PostGIS do przetestowania nowej, a prod nie ma
takiej tabeli, więc strona oparta o bazę pojechałaby pusta. **Cena:** strona nie pamięta, z kim
już rozmawiałeś — status „zadzwonione / odmowa / podpisane" wymaga tabeli i jest następnym krokiem.
Przed rozjazdem snapshotu z aplikacją broni `tests/unit/acquisition/dataset.test.ts`: przelicza
każdą minutę dojścia przez `estimateWalk` i każdą stawkę przez `suggestedRate`, więc zmiana modelu
spacerowego albo pasów cenowych wywala testy zamiast po cichu kłamać w terenie.

**Strony admina nie da się dziś obejrzeć bez obejścia** — `getAdminSession()` potrzebuje bazy,
której lokalnie nie ma. `/admin/akwizycja` eksportuje `ResearchView` właśnie po to: montujesz
ją na tymczasowym route bez auth, oglądasz, usuwasz route. Tak zweryfikowano oba motywy tej strony
(headless Chrome z `--user-data-dir` na osobnym profilu, żeby nie ruszać przeglądarki użytkownika;
`?motyw=light|dark` na stronie podglądu stempluje `data-theme`, bo Windows wymusza jeden z nich).

**Wymagany Node ≥ 22** (Vitest 4 potrzebuje `util.styleText`). Na Node 21 testy nie wystartują.

**Nie wpisuj polskich znaków wprost w `curl -d` z Git Basha na tej maszynie.** Shell przekodowuje
`ł ż ę ń ó ś ć` na stronę kodową konsoli, serwer dostaje bajty, które nie są poprawnym UTF-8,
a `TextDecoder` po cichu zamienia je na `U+FFFD` — i taki `�` zapisuje się do bazy jako
całkowicie poprawny UTF-8, więc nic nie protestuje. Tak wyszedł pierwszy lead testowy na
produkcji („Bu�garska", „Test Wdro�eniowy"). Sama aplikacja jest bez winy: formularz w
przeglądarce zawsze wysyła poprawny UTF-8, a prodowe API zwraca z bazy „Międzynarodowe Targi
Poznańskie" z pełną diakrytyką. **Payload z polskim tekstem zapisz do pliku i wyślij przez
`--data-binary @plik`**, a przed wysyłką sprawdź bajty (`ł` to `c5 82`) i brak BOM-a.
