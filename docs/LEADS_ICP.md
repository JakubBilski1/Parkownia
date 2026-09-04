# Notatka dla generatora leadów — Parkownia

**Ta notatka odpowiada na jedno pytanie: kogo w ogóle wpuścić na listę.**
Co powiedzieć, gdy już otworzy drzwi — kto decyduje, jaki jest pitch, jakie ryzyko
i którym legalnym kanałem wejść — jest w playbooku per segment
(`src/modules/acquisition/segments.ts`, widok `/admin/akwizycja`). Nie powielaj go tutaj.

Liczby w tym pliku pochodzą z kodu (`src/modules/leads/calc.ts`,
`src/modules/acquisition/*`) i z żywego API produkcji. Jeśli kod się zmieni, ten plik
jest nieaktualny.

---

## 1. Co właściwie sprzedajemy właścicielowi

Parkownia sprzedaje kierowcom rezerwacje miejsc na **wydarzenia masowe w Poznaniu**:
mecze Lecha na Enea Stadionie i targi na MTP. Właściciel nie wynajmuje placu na stałe —
udostępnia go **na kilka godzin, kilkanaście razy w roku**, na miejsce, które i tak
w tym czasie stoi puste.

Rozliczenie: prowizja od transakcji, dziś **50% od osób prywatnych, 30% od firm**
(`commission_rules`). Właściciel nie płaci nic z góry.

> **Nie obiecuj konkretnej prowizji w terenie.** Analiza w
> `src/modules/acquisition/economics.ts` pokazuje, że 50/30 jest odwrócone — wyższą
> stawkę bierzemy od segmentu, który ma najlepszą alternatywę (karton „PARKING 30 zł”
> i gotówka). Na stole jest **30/25 plus 20% dla kohorty założycielskiej**. Do czasu
> decyzji mów o warunkach, nie o liczbie.

To definiuje idealnego leada w jednym zdaniu: **ktoś, kto ma utwardzone miejsca blisko
bramy i NIE używa ich dokładnie wtedy, kiedy trwa event.**

---

## 2. Czego szukać, skoro research już jest

Snapshot OSM z 2026-08-11 (1200 m wokół obu obiektów) dał **73 zmapowane place,
6462 miejsca — ale 3998 z nich jest już płatnych**: pod samą Eneą stoi APCOA, przy MTP
Grupa MTP ma swoje. Realnie do zdobycia zostaje **~2464 miejsc** na 39 placach.

Dwa wnioski, które wyznaczają zadanie generatora leadów:

1. **OSM prawie nie mapuje prywatnych placów.** Salony samochodowe, parafie, podwórza
   spółdzielni i place zakładowe — czyli **segmenty o najkrótszym cyklu decyzyjnym** —
   w tym zestawieniu w większości nie istnieją. Lista z OSM jest startem, nie rynkiem.
2. Dlatego **wartość dodana to leady, których w datasecie nie ma.** Zanim dodasz obiekt,
   sprawdź, czy nie siedzi już w `CANDIDATE_SITES` albo `RECON_SITES` — duplikat to koszt
   wizyty wydany dwa razy.

Miejsce oznaczone `alreadyPaid` nie jest bezwartościowe, ale to **inna rozmowa**:
partnerstwo z operatorem (segment `OPERATOR`, tier B), nie akwizycja podaży.

---

## 3. Twarde filtry — bez tego lead jest bezwartościowy

Odrzucaj, zanim trafi na listę:

**1. Dalej niż 15 minut pieszo od obiektu.** Model chodu w aplikacji: 80 m/min,
współczynnik nadłożenia drogi ×1,3. Granice w linii prostej:

| pieszo | promień w linii prostej | stawka za event za miejsce |
|---|---|---|
| 0–5 min | **do 308 m** | 40–70 zł (śr. 55) |
| 5–10 min | **do 615 m** | 30–50 zł (śr. 40) |
| 10–15 min | **do 923 m** | 20–35 zł (śr. 27,50) |

**Powyżej 923 m kalkulator na landingu nie pokazuje ŻADNEJ kwoty** — `inReach: false`,
`events: 0`, `rate: null`. Taki lead zobaczy stronę bez liczby, czyli bez argumentu.
To granica ostra, nie sugestia.

**2. Konflikt z własnym użytkowaniem w oknie eventu.** Drugi co do ważności filtr
i najczęściej pomijany:

- **Enea Stadion** — mecze wieczorami i w weekendy → firma pracująca 8–17 w dni robocze
  jest **idealna**.
- **MTP** — targi w **dni robocze, w godzinach pracy** → ta sama firma pod MTP jest
  bezużyteczna, bo jej plac wtedy jest pełny. Pod MTP szukaj podaży mieszkaniowej,
  parafialnej, szkolnej po lekcjach, hotelowej poza sezonem targowym.

**3. Za mało miejsc.** Firma: **od 3 miejsc** — poniżej nie warto zakładać konta
i obsługi. (Dataset OSM ma próg 10 miejsc; dla leadów z terenu jest niższy, bo prywatny
plac na 5 miejsc przy bramie jest wart więcej niż 40 miejsc na granicy zasięgu.)
Osoba prywatna: 1 miejsce jest OK, ale **tylko w pasie 0–5 min**.

**4. Brak prawa do dysponowania miejscem.** Właściciel, zarząd wspólnoty lub
spółdzielni, albo najemca z pisemną zgodą. Nie: „sąsiad, który tam zawsze parkuje".
Przy biurowcach pytaj **od razu**, czy miejsca należą do zarządcy, czy do najemców —
w drugim przypadku to nie jedna rozmowa, tylko dwadzieścia.

**5. Wymaga oddania kluczyków albo obsługi przez człowieka na miejscu.** Regulamin
hosta **zakazuje** odbioru kluczyków, przestawiania i „pilnowania" aut
(`docs/LEGAL_RESEARCH.md`). Model to samoobsługa: kierowca dostaje kod/QR i wjeżdża.

**6. Miejsce niedostępne bez właściciela.** Brama otwierana wyłącznie ręcznie przez
kogoś, kto nie zamierza tam być w niedzielę o 19:00, to nie podaż — to obietnica.

**Nie dyskwalifikuje, ale MUSI być w rekordzie:** wysokość wjazdu do garażu lub
podziemia. Poniżej 195 cm odpada połowa SUV-ów, a to filtrujemy **przed** sprzedażą,
nie tłumaczymy po fakcie.

---

## 4. Gdzie fizycznie szukać

Punkty odniesienia (współrzędne z bazy produkcyjnej):

- **Enea Stadion** — ul. Bułgarska 17, `52.3977, 16.8581`, pojemność 43 269.
- **MTP** — ul. Głogowska 14, `52.4022, 16.9128`.

Obiekty dzieli ~3,5 km, więc **jeden adres praktycznie nigdy nie łapie obu** (z okolic
Enei do MTP jest 3476 m, czyli 56 minut pieszo). Każdy lead obsługuje jeden obiekt —
i to przesądza, w jakich godzinach ma być wolny.

**Wokół Enei** (Grunwald, Bułgarska, Ptasia, Marcelińska, Junikowo): salony i serwisy
samochodowe, warsztaty, hurtownie, hale i magazyny, parafie, biurowce, podwórza
spółdzielni.

**Wokół MTP** (Łazarz, Głogowska, Berwińskiego, Matejki, okolice dworca): dziedzińce
kamienic, garaże i podjazdy, wspólnoty z miejscami gościnnymi, parafie, hotele,
gastronomia z własnym placem.

---

## 5. Priorytet segmentów — kolejność jest ustalona, nie wymyślaj własnej

Tiery pochodzą z `SEGMENT_PLAYBOOK`; kryterium to długość cyklu decyzyjnego i to,
czy plac jest pusty w godzinach eventu:

| tier | znaczenie | segmenty |
|---|---|---|
| **A — idź w tym tygodniu** | jedna osoba decyduje, plac pusty w oknie eventu | `DEALER` (salon/serwis/komis), `WORSHIP` (parafia), `INDUSTRIAL` (zakład/magazyn), `RESIDENTIAL` (spółdzielnia/wspólnota) |
| **B — kolejka** | decyzja przez łańcuch albo wymaga rekonesansu | `OFFICE`, `SCHOOL`, `SPORTS`, `COMMERCIAL`, `HOTEL`, `PARKING_OTHER`, `OPERATOR` |
| **C — tylko inbound** | konflikt z podstawowym biznesem właściciela | `RETAIL` (market), `HOSPITAL` (szpital/przychodnia) |

**Nie wydawaj wizyty na tier C.** Szpital nigdy nie jest pusty, a market chce swojego
placu dokładnie w weekend, kiedy jest mecz. Szkoły miejskie (tier B) mają cykl 2–3
miesięcy i decyduje Wydział Oświaty, nie dyrektor — zbieraj je, ale nie licz na nie
w tym sezonie.

Segment z playbooka wpisz do rekordu leada. Bez niego nikt nie wie, z czym tam iść.

---

## 6. Sygnały i czerwone flagi

**Dobry lead wygląda tak:** utwardzona nawierzchnia; wjazd prosto z ulicy, bez manewru
przez cudzą posesję; brama z kodem, pilotem, LPR albo po prostu otwarta; oświetlenie;
decydent osiągalny na miejscu; plac widoczny jako pusty na zdjęciach satelitarnych
w porze eventu.

**Czerwone flagi:** trawa albo błoto (deszcz plus 40 aut = koniec współpracy); wjazd
przez podwórko-studnię, gdzie nie da się zawrócić; „musimy zapytać wszystkich
mieszkańców"; plac już wynajęty komuś na mecze; teren związany umową z operatorem;
umowa najmu zakazująca podnajmu miejsc; **miejsce za policyjną blokadą w dniu meczu** —
bezwartościowe niezależnie od odległości, sprawdź strefy zamknięte wokół Enei, zanim
zmierzysz metry.

---

## 7. Co ma wrócić w rekordzie leada

Pola zgodne z `leadInputSchema` (`src/modules/leads/schemas.ts`) — wtedy rekord wchodzi
do systemu bez tłumaczenia:

| pole | wymagane | dopuszczalne wartości |
|---|---|---|
| `address` | **tak** | 3–240 znaków, adres obiektu |
| `lat` / `lng` | zalecane | Polska (49–55 / 14–24); bez nich nie policzymy zasięgu |
| `objectName` | nie | nazwa firmy lub obiektu, do 120 znaków |
| `objectType` | zalecane | `LOT`, `DRIVEWAY`, `COMPANY_LOT`, `GARAGE`, `OTHER` |
| `spots` | **tak** | 1–100, liczba miejsc **realnie wolnych w czasie eventu** |
| `ownerKind` | zalecane | `INDIVIDUAL` / `BUSINESS` — decyduje o prowizji |
| `contactName` | **tak** | osoba decyzyjna, nie recepcja |
| `phone` / `email` | **co najmniej jedno** | — |
| `contactPreference` | **tak** | `PHONE` / `EMAIL`, spójne z podanym kontaktem |
| `source` | tak | skąd lead, np. `obchod-lazarz-2026-09` |

Poza schematem, ale bezcenne przy kwalifikacji: **segment z playbooka**, **wysokość
wjazdu w cm**, typ dostępu (`OPEN` / `BARRIER_CODE` / `BARRIER_REMOTE` / `GATE_MANUAL` /
`LPR`), nawierzchnia, ogrodzenie i oświetlenie, godziny konfliktu z własnym
użytkowaniem oraz **punkt wjazdu, jeśli jest inny niż adres** — nawigacja prowadzi
kierowcę do bramy, nie do środka placu.

---

## 8. Ograniczenie prawne — przeczytaj, zanim cokolwiek wyślesz

**Cold-mailing, cold-SMS i telefon „na zimno" do właścicieli są zakazane** (art. 398
Prawa komunikacji elektronicznej — **dotyczy też B2B**). W `docs/LEGAL_RESEARCH.md`
jest to ryzyko wysokie, kara do 3% obrotu.

- **Wolno:** zbudować listę obiektów i osób do kontaktu **offline** — wizyta osobista,
  pismo pocztą, ulotka do skrzynki, publikacja w lokalnej grupie, reklama
  nietargetowana, polecenia, oraz ruch przychodzący z landingu `/dla-wlascicieli`.
- **Nie wolno:** kupować baz, scrapować adresów e-mail i telefonów pod wysyłkę, wysyłać
  maili ani SMS-ów bez uprzedniej, odrębnej zgody na dany kanał.

Zgoda z landingu jest rozdzielna per kanał (`marketingEmailConsent`,
`marketingPhoneConsent`), pusta domyślnie i oddzielona od regulaminu — **dopiero ona
otwiera drogę do wysyłki.** Dane z CEIDG/KRS służą do ustalenia, **kogo odwiedzić**,
nie do wysyłki.

Produkt tego generatora to **lista miejsc i osób do odwiedzenia, nie lista mailingowa.**

---

## 9. Weryfikacja leada w pięć sekund

Zanim lead trafi na listę, sprawdź go tym samym silnikiem, który liczy landing:

```bash
curl -s "https://parkownia.com/api/dla-wlascicieli/potencjal?lat=52.3990&lng=16.8620"
```

Odpowiedź z żywej produkcji (2026-09-04, skrót):

```json
{"venues":[{"key":"ENEA","distanceMeters":302,"walkMinutes":5,"inReach":true},
           {"key":"MTP","distanceMeters":3476,"walkMinutes":56,"inReach":false}],
 "nearestMinutes":5,"events":{"total":6,"football":6,"tradeFair":0},
 "rate":{"band":"0–5 min","minGr":4000,"midGr":5500,"maxGr":7000}}
```

Czytaj tak: `inReach: false` przy obu obiektach → odrzuć. `rate: null` → odrzuć.
`events.total` to **realna liczba wydarzeń z bazy na najbliższe 12 miesięcy**, liczona
wyłącznie dla obiektów w zasięgu — spada, gdy kalendarz się wyczerpuje, i wtedy każdy
lead wygląda słabiej, niż jest wart. Limit: 30 zapytań na minutę z jednego IP.

Stan kalendarza na 2026-09-04: **6 meczów** w zasięgu Enei, **8 wydarzeń** w zasięgu MTP
(6 targów + 2 inne). Dataset akwizycji zakłada 9 i 8 — jest starszy o trzy tygodnie
i mecze zdążyły się rozegrać.

---

## 10. Ile to jest warte — arytmetyka, którą lead usłyszy

Wzór: `stawka × liczba miejsc × liczba eventów`, minus prowizja. Zakładana pełna
obsadzoność, więc to **sufit, nie prognoza** — i dokładnie tak jest opisane na landingu.

- **Firma, 30 miejsc, 6 min od Enei, 6 meczów:** 40 zł × 30 × 6 = **7 200 zł brutto**,
  przy dzisiejszych 30% → **5 040 zł dla właściciela**.
- **Podjazd, 2 miejsca, 4 min od MTP, 8 wydarzeń:** 55 zł × 2 × 8 = **880 zł brutto**,
  przy dzisiejszych 50% → **440 zł dla właściciela**.

Drugi przykład to jest właśnie ten problem z `economics.ts`: **440 zł na sezon to kwota,
dla której nikt nie otworzy drzwi dwa razy** — a właściciel podjazdu ma alternatywę
w postaci kartonu i gotówki. Dlatego jedna rozmowa z firmą jest warta kilkanaście
rozmów z właścicielami podjazdów, a kalendarz eventów jest dla wszystkich ten sam.
