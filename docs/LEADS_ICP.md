# Notatka dla generatora leadów — Parkownia

Kogo szukamy, kogo NIE, i co ma znaleźć się w rekordzie. Liczby w tym pliku pochodzą
z kodu (`src/modules/leads/calc.ts`, `src/modules/leads/service.ts`) i z żywego API
produkcji — nie z wyobraźni. Jeśli kod się zmieni, ten plik jest nieaktualny.

---

## 1. Co właściwie sprzedajemy właścicielowi

Parkownia sprzedaje kierowcom rezerwacje miejsc na **wydarzenia masowe w Poznaniu**:
mecze Lecha na Enea Stadionie i targi na MTP. Właściciel nie wynajmuje placu na stałe —
udostępnia go **na kilka godzin, kilkanaście razy w roku**, na miejsce, które i tak
w tym czasie stoi puste.

Rozliczenie: prowizja od transakcji. **50% od osób prywatnych, 30% od firm**
(`commission_rules`, `COMMISSION_PCT`). Właściciel nie płaci nic z góry.

To definiuje idealnego leada w jednym zdaniu: **ktoś, kto ma utwardzone miejsca blisko
bramy i NIE używa ich dokładnie wtedy, kiedy trwa event.**

---

## 2. Twarde filtry — bez tego lead jest bezwartościowy

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

- **Enea Stadion** — mecze wieczorami i w weekendy → firma pracująca 8–17 w dni
  robocze jest **idealna**.
- **MTP** — targi w **dni robocze, w godzinach pracy** → ta sama firma pod MTP jest
  bezużyteczna, bo jej plac wtedy jest pełny. Pod MTP szukaj podaży mieszkaniowej,
  parafialnej, szkolnej po lekcjach, gastronomicznej.

**3. Za mało miejsc.** Firma: **od 3 miejsc** — poniżej nie warto zakładać konta
i obsługi. Osoba prywatna: 1 miejsce jest OK, ale **tylko w pasie 0–5 min**;
pojedynczy podjazd 800 m od bramy to 20–35 zł za event, nikt się nie pofatyguje.

**4. Brak prawa do dysponowania miejscem.** Właściciel, zarząd wspólnoty/spółdzielni
albo najemca z pisemną zgodą. Nie: „sąsiad, który tam zawsze parkuje".

**5. Wymaga oddania kluczyków albo obsługi przez człowieka na miejscu.** Regulamin
hosta **zakazuje** odbioru kluczyków, przestawiania i „pilnowania" aut
(`docs/LEGAL_RESEARCH.md`). Model to samoobsługa: kierowca dostaje kod/QR i wjeżdża.
Parking z obowiązkowym parkingowym odpada.

**6. Miejsce niedostępne bez właściciela.** Brama otwierana wyłącznie ręcznie przez
kogoś, kto nie zamierza tam być w niedzielę o 19:00, to nie jest podaż — to obietnica.

**Nie dyskwalifikuje, ale MUSI być w rekordzie:** wysokość wjazdu do garażu/podziemia.
Poniżej 195 cm odpada połowa SUV-ów, a to filtrujemy **przed** sprzedażą, nie tłumaczymy
po fakcie.

---

## 3. Gdzie fizycznie szukać

Punkty odniesienia (współrzędne z bazy produkcyjnej):

- **Enea Stadion** — ul. Bułgarska 17, `52.3977, 16.8581`, pojemność 43 269.
- **MTP** — ul. Głogowska 14, `52.4022, 16.9128`.

Obiekty dzieli ~3,5 km, więc **jeden adres praktycznie nigdy nie łapie obu** (z okolic
Enei do MTP jest 3476 m, czyli 56 minut pieszo). Każdy lead obsługuje jeden obiekt —
i to przesądza o tym, w jakich godzinach ma być wolny.

**Wokół Enei** (Grunwald, Bułgarska, Ptasia, Marcelińska, Junikowo): hurtownie i magazyny,
warsztaty i salony samochodowe, biurowce, przychodnie, hale i kluby sportowe, szkoły,
kościoły, place przy marketach, tereny uczelni.

**Wokół MTP** (Łazarz, Głogowska, Berwińskiego, Matejki, okolice dworca): dziedzińce
kamienic, garaże i podjazdy, wspólnoty z miejscami gościnnymi, parafie, gastronomia
z własnym placem, kluby fitness.

---

## 4. Segmenty w kolejności priorytetu

**A. Firma z placem, która pustoszeje po godzinach — pod Eneą.**
Hurtownia, warsztat, biurowiec, salon, przychodnia, bank, urząd. 10–60 miejsc,
utwardzone, zwykle ogrodzone, jeden decydent, jedna rozmowa = kilkadziesiąt miejsc.
Prowizja 30%, czyli mniej z każdej złotówki niż od osoby prywatnej, ale wolumen
i przewidywalność biją margines. **To jest segment numer jeden.**

**B. Wspólnoty i spółdzielnie mieszkaniowe z miejscami gościnnymi lub naziemnymi.**
Duża podaż pod jednym podpisem, ale decyzja idzie przez zarząd albo uchwałę — długi
cykl. Warto zbierać, nie warto na nich czekać.

**C. Instytucje z placem, nieczynne w weekend.** Kościoły (uwaga na msze), szkoły,
uczelnie, przychodnie, urzędy. Mecz w sobotę wieczorem = pusty plac, a dochód jest czysty,
więc decyzja bywa szybka.

**D. Osoby prywatne — podjazdy, garaże, miejsca w kamienicach.** 1–4 miejsca, prowizja
50%, najłatwiej zamknąć. Sensowne **tylko w pasie 0–5 min**; dalej koszt obsługi zjada
wynik. Pod MTP to często jedyny realny segment.

**E. Operatorzy komercyjni.** Mają własne systemy i cenniki, konwersja niska.
Niski priorytet w MVP — chyba że odezwą się sami.

---

## 5. Sygnały i czerwone flagi

**Dobry lead wygląda tak:** utwardzona nawierzchnia; wjazd prosto z ulicy, bez manewru
przez cudzą posesję; brama z kodem, pilotem, LPR albo po prostu otwarta; oświetlenie;
decydent osiągalny jednym telefonem; plac widoczny jako pusty na zdjęciach satelitarnych
w porze eventu.

**Czerwone flagi:** trawa albo błoto (deszcz plus 40 aut = koniec współpracy); wjazd przez
podwórko-studnię, gdzie nie da się zawrócić; „musimy zapytać wszystkich mieszkańców";
plac już wynajęty komuś na mecze; teren związany umową z operatorem; **miejsce za
policyjną blokadą w dniu meczu** — jest bezwartościowe niezależnie od odległości,
sprawdź strefy zamknięte wokół Enei, zanim zmierzysz metry.

---

## 6. Co ma wrócić w rekordzie leada

Pola zgodne z `leadInputSchema` (`src/modules/leads/schemas.ts`) — wtedy rekord wchodzi
do systemu bez tłumaczenia:

| pole | wymagane | dopuszczalne wartości |
|---|---|---|
| `address` | **tak** | 3–240 znaków, adres obiektu |
| `lat` / `lng` | zalecane | Polska (49–55 / 14–24); bez nich nie policzymy zasięgu |
| `objectName` | nie | nazwa firmy lub obiektu, do 120 znaków |
| `objectType` | zalecane | `LOT`, `DRIVEWAY`, `COMPANY_LOT`, `GARAGE`, `OTHER` |
| `spots` | **tak** | 1–100, liczba miejsc **realnie wolnych w czasie eventu** |
| `ownerKind` | zalecane | `INDIVIDUAL` / `BUSINESS` — decyduje o prowizji 50/30 |
| `contactName` | **tak** | osoba decyzyjna, nie recepcja |
| `phone` / `email` | **co najmniej jedno** | — |
| `contactPreference` | **tak** | `PHONE` / `EMAIL`, spójne z podanym kontaktem |
| `source` | tak | skąd lead, np. `obchod-lazarz-2026-09` |

Poza schematem, ale bezcenne przy kwalifikacji: **wysokość wjazdu w cm**, typ dostępu
(`OPEN` / `BARRIER_CODE` / `BARRIER_REMOTE` / `GATE_MANUAL` / `LPR`), nawierzchnia,
ogrodzenie i oświetlenie, godziny konfliktu z własnym użytkowaniem oraz **punkt wjazdu,
jeśli jest inny niż adres** — nawigacja prowadzi kierowcę do bramy, nie do środka placu.

---

## 7. Ograniczenie prawne — przeczytaj, zanim cokolwiek wyślesz

**Cold-mailing, cold-SMS i telefon „na zimno" do właścicieli są zakazane** (art. 398
Prawa komunikacji elektronicznej — **dotyczy też B2B**). Zapisane w
`docs/LEGAL_RESEARCH.md` jako ryzyko wysokie, kara do 3% obrotu.

Wynika z tego wprost, co generator leadów ma robić:

- **Wolno:** zbudować listę obiektów i osób do kontaktu **offline** — wizyta osobista,
  ulotka do skrzynki, poczta tradycyjna, reklama nietargetowana, polecenia, oraz ruch
  przychodzący z landingu `/dla-wlascicieli`.
- **Nie wolno:** kupować baz, scrapować adresów e-mail i telefonów pod wysyłkę, wysyłać
  maili ani SMS-ów bez uprzedniej, odrębnej zgody na dany kanał.

Zgoda z landingu jest rozdzielna per kanał (`marketingEmailConsent`,
`marketingPhoneConsent`), pusta domyślnie i oddzielona od regulaminu — **dopiero ona
otwiera drogę do wysyłki.** Lead bez zgody to lead do rozmowy twarzą w twarz.

Produkt tego generatora to **lista miejsc i osób do odwiedzenia, nie lista mailingowa.**

---

## 8. Weryfikacja leada w pięć sekund

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
(6 targów + 2 inne).

---

## 9. Ile to jest warte — arytmetyka, którą lead usłyszy

Wzór: `stawka × liczba miejsc × liczba eventów`, minus prowizja. Zakładana pełna
obsadzoność, więc to **sufit, nie prognoza** — i dokładnie tak jest opisane na landingu.

- **Firma, 30 miejsc, 6 min od Enei, 6 meczów:** 40 zł × 30 × 6 = **7 200 zł brutto**,
  prowizja 30% → **5 040 zł dla właściciela**.
- **Podjazd, 2 miejsca, 4 min od MTP, 8 wydarzeń:** 55 zł × 2 × 8 = **880 zł brutto**,
  prowizja 50% → **440 zł dla właściciela**.

Widać, dlaczego segment A jest pierwszy: jedna rozmowa z firmą jest warta tyle,
co kilkanaście rozmów z właścicielami podjazdów, a kalendarz eventów jest dla wszystkich
ten sam.
