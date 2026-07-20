# LEGAL_RESEARCH.md — Parkownia

> **To NIE jest opinia prawna ani porada podatkowa.** To research prawny (stan na 2026-07, prawo polskie + UE)
> zebrany, by zbriefować właściciela projektu i przygotować rozmowę z **licencjonowanym radcą prawnym / adwokatem**
> oraz **doradcą podatkowym**. Dokładne oznaczenia jednostek redakcyjnych niektórych przepisów wymagają weryfikacji
> w tekście jednolitym — kierunek merytoryczny jest potwierdzony, część cytatów oznaczono „(do weryfikacji)".
> Finalne dokumenty (polityka prywatności, regulamin, umowy) i decyzje regulacyjne muszą zatwierdzić licencjonowani
> specjaliści. Źródła zebrane przy każdym obszarze na końcu.

**Kontekst:** marketplace parkingowy, faza przedstartowa (obecnie tylko landing akwizycyjny `/dla-wlascicieli`
zbierający leady właścicieli; kod sprzedaży istnieje, ale zero transakcji). **Administrator/operator: Jakub Bilski,
osoba fizyczna bez zarejestrowanej działalności (brak JDG/CEIDG, brak spółki, brak VAT) na 2026-07-20.** Model
przychodowy: prowizja 50% (os. prywatna) / 30% (firma). Płatności: Stripe Connect Express, destination charges,
Parkownia jako merchant-of-record. Procesorzy/odbiorcy: Stripe, pbdevs (mail), SMSAPI, Hetzner (EOG/DE), geokoder
Nominatim/Geoapify, S3.

---

## 0. Najważniejsze wnioski (przeczytaj to, jeśli nic więcej)

1. **[KRYTYCZNE] Osoba fizyczna + merchant-of-record = odpowiedzialność całym majątkiem prywatnym.** Za niewykonanie
   usługi, podwójną sprzedaż miejsca, roszczenia konsumenckie (potencjalnie masowe przy evencie na 40 tys. osób), a także
   kary RODO (do 20 mln EUR / 4%) i DAC7 (do 1 mln zł) — Jakub odpowiada **osobiście, bez osłony osoby prawnej**.
   **Mocna rekomendacja: sp. z o.o. przed pierwszą transakcją** (ograniczenie odpowiedzialności, czystość VAT/DAC7,
   wymóg KYB Stripe). Decyzja łączna radcy + doradcy podatkowego.
2. **[KRYTYCZNE] Nie wolno uruchomić sprzedaży bez rejestracji działalności.** Bez wpisu nie da się spełnić obowiązku
   identyfikacji przedsiębiorcy (art. 12 UPK: firma, NIP, adres), a PIT należy się od pierwszej złotówki. Kwartalny
   limit działalności nierejestrowanej 2026 (**10 813,50 zł** przychodu) padnie przy pierwszym większym evencie, a model
   MoR i tak ten reżim dyskwalifikuje. **Sama faza landingu bez transakcji jest dopuszczalna bez rejestracji.**
3. **[WYSOKIE] DAC7 — realny, często pomijany obowiązek.** Udostępnianie miejsc postojowych = „udostępnianie
   nieruchomości/ich części" → Parkownia jest raportującym operatorem platformy. **Brak progu de minimis dla
   nieruchomości** — obowiązek należytej staranności i raportowania hostów do Szefa KAS (do 31 stycznia) od PIERWSZEJ
   transakcji. Kara do 1 mln zł. **Model danych hosta trzeba zaprojektować pod DAC7 już teraz.**
4. **Decyzja nadrzędna, która przesądza resztę:** czy Parkownia jest **STRONĄ umowy z kierowcą (sprzedawca / MoR)**,
   czy **tylko dostawcą platformy** kojarzącej hosta z kierowcą? Rozstrzyga jednocześnie: odpowiedzialność konsumencką,
   utratę „tarczy pośrednika" z DSA art. 6 ust. 3, podstawę i limit VAT (prowizja vs GMV), ekspozycję majątkową i status
   usług płatniczych (KNF).
5. **Landing JUŻ TERAZ ma obowiązki:** pełna klauzula informacyjna RODO (art. 13), rozdzielne zgody marketingowe
   (art. 398 PKE), regulamin UŚUDE (art. 8), a przy trackerach — baner cookie (art. 399 PKE). Wadliwe zgody = cała baza
   zgód prawnie bezużyteczna. **Zero cold-mailingu/cold-SMS do właścicieli** (art. 398 PKE dotyczy też B2B).

---

## 1. Rejestr ryzyk (od najpoważniejszego)

| # | Ryzyko | Obszar | Waga | Co zrobić |
|---|--------|--------|------|-----------|
| 1 | Os. fizyczna + MoR → odpowiedzialność całym majątkiem prywatnym (double-sell, roszczenia, kary RODO/DAC7) | forma prawna | **krytyczne** | Przesądzić formę PRZED transakcją; rekom. sp. z o.o. Do tego czasu nie uruchamiać sprzedaży. |
| 2 | Sprzedaż bez rejestracji: brak art. 12 UPK, zaległość PIT/ZUS/VAT, art. 601 KW; limit nierejestrowanej padnie od razu | rejestracja / podatki | **krytyczne** | Rejestracja JDG/spółki przed startem; Stripe na dane podmiotu z NIP. Landing bez transakcji — OK. |
| 3 | Zignorowanie DAC7 (miejsce = nieruchomość, brak de minimis, raport od 1. transakcji) | podatki / DAC7 | wysokie | Potwierdzić z doradcą; wbudować pola DAC7 w model hosta; blokada wypłaty bez kompletu danych. |
| 4 | Cold-mailing/cold-SMS do właścicieli bez zgody (art. 398 PKE, też B2B) | marketing / PKE | wysokie | Wyłącznie inbound albo kanały spoza PKE. Nie kupować baz, nie scrapować, nie obdzwaniać „na zimno". |
| 5 | Wadliwe zgody na landingu (checkbox domyślny/zbiorczy) → zgoda nieważna (Planet49) | marketing / RODO | wysokie | Rozdzielne, puste checkboxy per kanał, oddzielone od regulaminu, aktywne kliknięcie. |
| 6 | Niekompletna klauzula art. 13 na formularzu leada | RODO | wysokie | Wdrożyć pełny 10-punktowy wzór (§3) + link do polityki prywatności; przegląd radcy. |
| 7 | Brak umów powierzenia (art. 28) z pbdevs/geokoder/S3; adres leada do publicznego Nominatim bez DPA | RODO / powierzenie | wysokie | Zebrać DPA; Nominatim → self-hosting (Hetzner/EOG) lub dostawca z DPA; wysyłać sam adres, bez kontaktu. |
| 8 | Polityka zwrotów 100/50/0% oparta błędnie na art. 38 pkt 12 dla KAŻDEGO parkingu | konsument | wysokie | Rozdzielić parking eventowy (z datą → art. 38 pkt 12) od nie-eventowego (14 dni / art. 38 pkt 1). |
| 9 | VAT liczony od prowizji, gdy fiskus policzy limit 240 000 zł od całego GMV (MoR, art. 8 ust. 2a) | podatki / VAT | wysokie | Stanowisko doradcy / interpretacja KIS przed startem; zaprojektować płatności pod kwalifikację. |
| 10 | Przekwalifikowanie najmu miejsca na przechowanie (KC art. 835) → odpowiedzialność za kradzież/uszkodzenie auta | odpowiedzialność | wysokie | Flow = weryfikacja opłaty, nie piecza; zakaz odbioru kluczyków; copy „najem, brak pieczy". |
| 11 | Klauzule wyłączające odpowiedzialność wobec konsumenta = abuzywne (art. 385¹/385³; art. 473 §2); MoR + DSA art. 6 ust. 3 zdejmują „tarczę pośrednika" | konsument / DSA | wysokie | Bez generalnych wyłączeń; regulamin, reklamacje, zwroty jak dla strony wobec konsumenta; audyt UOKiK. |
| 12 | Transfer do Stripe (USA) na EU-US DPF zagrożonym po wyroku SN USA 29.06.2026 i skardze noyb (Schrems III) | RODO / transfery | wysokie | Nie polegać tylko na DPF: wpiąć SCC + wykonać TIA; monitorować TSUE; ustalić lokalizację S3/pbdevs. |
| 13 | Parkownia postrzegana jako strona umowy (MoR) → własna odpowiedzialność za działania hosta | DSA / konsument | wysokie | Przesądzić i ujawnić rolę; gwarancja przy niewpuszczeniu (zwrot/miejsce zastępcze) + regres do hosta. |
| 14 | Adres leada (z nazwiskiem/telefonem) do geokodera/tiles bez ujawnienia i oceny transferu | RODO / geokoder | średnie | Ujawnić geokoder w klauzuli; ustalić lokalizację; self-hosting Nominatim; wysyłać sam adres. |
| 15 | Brak regulaminu UŚUDE (art. 8) na landingu — obowiązek działa już teraz | konsument / UŚUDE | średnie | Wdrożyć regulamin udostępniony do pobrania przed zapisem leada. |
| 16 | Brak mechanizmu wycofania zgody / STOP / suppression list (art. 21, art. 7 ust. 3 RODO) | marketing / RODO | średnie | „Wypisz się" w każdym mailu, STOP w SMS, suppression list przed każdą wysyłką; test e2e. |
| 17 | Brak regulaminu DSA (art. 14), punktów kontaktowych (art. 11/12), notice-and-action (art. 16-17) na starcie | DSA | średnie | Wdrożyć przed 1. transakcją; udokumentować status mikro (zwolnienia art. 19/29). |
| 18 | Pobór/redystrybucja cudzych środków jako MoR = możliwe usługi płatnicze (KNF) | płatności / KNF | średnie | Utrzymać Stripe jako licencjonowaną instytucję (destination charges); osobna analiza przed skalowaniem. |
| 19 | Baner cookie bez realnego „Odrzuć" lub trackery przed zgodą (art. 399 PKE) | cookies / PKE | średnie | Ustalić, czy są trackery; jeśli tak — CMP blokujący skrypty; jeśli nie — info o cookies „niezbędnych". |
| 20 | Brak rejestru czynności przetwarzania (RCPD, art. 30) — wyjątek <250 osób NIE działa (rdzeń biznesu) | RODO | niskie | Założyć i utrzymywać prosty RCPD od początku. |

---

## 2. Briefing obszar po obszarze

### 2.1. RODO — administrator, podstawy, obowiązek informacyjny, powierzenie, transfery
- **Osoba fizyczna jest pełnoprawnym administratorem** (RODO art. 4 pkt 7); rejestracja działalności nie jest
  przesłanką. **Wyłączenie „domowe/osobiste"** (art. 2 ust. 2 lit. c, motyw 18) **NIE obejmuje** komercyjnego marketplace.
- **Podstawy prawne:** leady — art. 6 ust. 1 lit. b (czynności przedumowne) / lit. f (budowa bazy podaży, z testem
  równowagi LIA); kierowcy — lit. b; marketing — lit. a + **odrębna zgoda z art. 398 PKE**; roszczenia — lit. f.
- **RCPD (art. 30) WYMAGANY** mimo skali (przetwarzanie regularne, niesporadyczne, rdzeń biznesu — wyjątek <250 osób
  nie działa). (potwierdzone)
- **Umowy powierzenia (art. 28)** z: pbdevs, SMSAPI, Hetzner, S3, geokoderem (jeśli działa na zlecenie). **Stripe** to
  hybryda: procesor dla realizacji płatności + **niezależny administrator** dla KYC/AML/anty-fraud → obowiązuje jego DPA,
  nie klasyczne powierzenie; ujawnić Stripe jako odbiorcę/odrębnego administratora.
- **Transfery poza EOG (art. 44-46):** Stripe (USA) na EU-US DPF — **zagrożony** po wyroku SN USA 29.06.2026 i skardze
  noyb do TSUE. **Plan B: SCC + ocena skutków transferu (TIA).** Ustalić lokalizację S3 i pbdevs (EOG vs USA).
- **IOD (art. 37):** na etapie lead-gen prawdopodobnie niewymagany; ocenić ponownie przy pełnym starcie.

### 2.2. Marketing, zgody, cookies, komunikacja elektroniczna (PKE/UŚUDE)
- **Marketing e-mail i SMS wymaga ODRĘBNEJ zgody telekomunikacyjnej (Prawo komunikacji elektronicznej, art. 398)** —
  niezależnej od zgody RODO, **osobno dla każdego kanału**, dobrowolnej, niezaznaczonej domyślnie. Kara do 3% przychodu
  lub 1 mln zł. (potwierdzone) PKE zastąpiła dawne art. 10 UŚUDE + art. 172 Prawa telekomunikacyjnego.
- **Cold outreach do właścicieli (mail/SMS/telefon „na zimno") jest zakazany** — art. 398 PKE dotyczy też B2B.
  Pozyskiwanie hostów: inbound albo kanały spoza PKE (kontakt osobisty, poczta, reklama nietargetowana).
- **Cookies/trackery (art. 399 PKE):** jeśli na landingu będzie analityka/remarketing firm trzecich → CMP blokujący
  skrypty przed zgodą, równorzędne „Akceptuję"/„Odrzuć". Jeśli tylko cookies „ściśle niezbędne" (JWT httpOnly, CSRF,
  localStorage motywu) — wystarczy informacja, bez banera zgody.
- **Wycofanie zgody:** link „wypisz się" w mailu, STOP w SMS, suppression list sprawdzana przed każdą wysyłką.

### 2.3. Rejestracja działalności
- Prowizyjny marketplace spełnia definicję **działalności gospodarczej** (zorganizowana, ciągła, zarobkowa —
  Prawo przedsiębiorców art. 3). **Działalność nierejestrowana** (art. 5): limit **2026 = 10 813,50 zł przychodu/kwartał**
  (nowy reżim kwartalny), brak działalności w ostatnich 60 mies., brak wymogu koncesji. **Model MoR i tak dyskwalifikuje
  ten reżim** i limit padnie przy pierwszym evencie.
- **Rejestracja JDG/spółki przed pierwszą prowizją.** Stripe konfigurować na dane podmiotu (NIP/REGON, KYB), nie na konto
  osoby prywatnej. **sp. z o.o.** rekomendowana przy planach kapitałowych i dla ograniczenia odpowiedzialności (koszt:
  pełna księgowość, CIT).

### 2.4. Prawo konsumenckie + regulamin
- **Regulamin UŚUDE (art. 8)** obowiązkowy **już na landingu** (formularz/newsletter to usługa elektroniczna): rodzaje/zakres
  usług, wymagania techniczne, zakaz treści bezprawnych, warunki zawarcia/rozwiązania, tryb reklamacyjny — udostępniony do
  pobrania przed zapisem leada.
- **Prawo odstąpienia 14 dni (art. 27)** — kluczowy **wyjątek art. 38 pkt 12** (usługi związane z wypoczynkiem/
  wydarzeniami/najem, jeżeli oznaczono dzień lub okres). Działa **tylko dla parkingu eventowego z oznaczoną datą**; dla
  parkingu codziennego/abonamentowego jest **wątpliwy** (katalog zamknięty, wykładnia wąska) → polityka 50%/0% byłaby
  **klauzulą abuzywną**. Rozdzielić dwa produkty; dla nie-eventowego respektować 14 dni albo art. 38 pkt 1 (wyraźna zgoda
  + oświadczenie o utracie prawa). Brak jednolitego orzecznictwa — **opinia radcy.**
- **Art. 12 UPK:** komplet informacji przedumownych z pełną identyfikacją przedsiębiorcy (firma, NIP, adres) → wymaga
  rejestracji. **Art. 12a:** przy hoście-osobie prywatnej relacja to C2C (UPK nie chroni) — kierowca musi być uprzedzony.
- **Art. 17 UPK:** przycisk finalizacji oznaczony **„zamówienie z obowiązkiem zapłaty" / „kupuję i płacę"** + cena łączna
  brutto przed zamówieniem (inaczej umowa niezawarta, brak podstawy poboru).
- **Reklamacje:** termin odpowiedzi **14 dni (art. 7a UPK)** — brak odpowiedzi = uznanie z mocy prawa. Potwierdzenie umowy
  na trwałym nośniku (art. 21). ODR wygaszony 20.07.2025 — nie linkować; wskazać Inspekcję Handlową / polubowny sąd konsumencki.
- **Audyt regulaminu pod rejestr klauzul niedozwolonych UOKiK** (art. 385¹ KC) przed publikacją; nie kopiować cudzych.

### 2.5. Charakter usługi i odpowiedzialność za pojazd (najem vs przechowanie)
- **Fundamentalne rozróżnienie:** **najem miejsca** (KC art. 659) → brak pieczy nad pojazdem, brak odpowiedzialności za
  kradzież/uszkodzenie. **Przechowanie** (KC art. 835) → obowiązek pieczy, odpowiedzialność za rzecz (domniemanie winy).
  **O kwalifikacji decydują FAKTY, nie nazwa:** host odbierający kluczyki, kierujący na stanowiska, „pilnujący" aut, a nawet
  skaner QR + host przy bramie mogą zostać odczytane jako **piecza** → przekwalifikowanie na przechowanie.
- **Rekomendowany model: najem miejsca, parking niestrzeżony/samoobsługowy.** Skan QR = wyłącznie weryfikacja opłaconego
  wjazdu. Regulamin hosta: **zakaz** odbioru kluczyków, przestawiania i „pilnowania" aut. **Copy marketingowy nie może
  obiecywać „bezpiecznego/pilnowanego" parkingu** (sąd oprze na obietnicy kwalifikację przechowania).
- **Wobec konsumenta: żadnych generalnych wyłączeń odpowiedzialności.** Bezwzględnie nie wolno wyłączyć odpowiedzialności
  za szkodę na osobie (art. 385³ pkt 1) ani za szkodę umyślną (art. 473 §2). Dopuszczalne tylko wąskie, adekwatne ograniczenia.
- **Scenariusz „host nie wpuścił opłaconego kierowcy":** przy MoR + DSA art. 6 ust. 3 odpowiedzialność Parkowni jest realna
  **niezależnie od winy hosta** — zdefiniować gwarancję (natychmiastowy zwrot i/lub miejsce zastępcze) + regres do hosta w umowie B2B.
- **OC:** wymóg/rekomendacja OC hosta (twardy dla firm/operatorów); rozważyć OC platformy. `art. 429 KC` — należyta
  staranność w wyborze hosta.

### 2.6. Podatki + DAC7
- **PIT** od prowizji od pierwszej złotówki (skala 12%/32% / liniowy 19% / ryczałt — stawka zależna od PKWiU pośrednictwa,
  z doradcą). „Brak firmy" nie zwalnia z podatku.
- **VAT:** limit zwolnienia **2026 = 240 000 zł** (art. 113). **Sporne i kluczowe:** czy limit liczy się od **prowizji**,
  czy od **całego GMV** (MoR, art. 8 ust. 2a — fiskus może uznać Parkownię za świadczącą usługę parkingową). **Rekomendowana
  interpretacja indywidualna KIS** przed startem.
- **DAC7 (dyrektywa UE, implementacja PL — ustawa z 23.05.2024, Dz.U. 2024 poz. 879):** Parkownia = **raportujący operator
  platformy**, miejsce postojowe = „udostępnienie nieruchomości", **brak progu de minimis**. Obowiązki: **należyta staranność
  + zbieranie i weryfikacja danych hostów**, rejestracja operatora + numer, **raport do Szefa KAS do 31 stycznia** za rok
  poprzedni, poinformowanie hosta o przekazanych danych. **Kara do 1 mln zł.** **Zablokować wypłatę hostowi bez kompletu danych.**
  - **Pola DAC7 do zebrania od hosta (zaprojektować w modelu już teraz):** NIP/PESEL, data urodzenia, adres, nr rachunku,
    **adres udostępnianej nieruchomości**, nr księgi wieczystej (jeśli dostępny), liczba dni udostępnienia, wynagrodzenie.
- **Hosty (info do FAQ):** przychód opodatkowany — najem prywatny ryczałt **8,5%/12,5%** albo działalność; Parkownia raportuje
  ich dane do KAS (DAC7) — z zaleceniem własnej konsultacji.
- **Kasa fiskalna:** zwolnienie przy **100% płatności bezgotówkowych** (Stripe) + pełna, powiązana ewidencja (limit 20 000 zł,
  zmiana od 1.04.2026 — do potwierdzenia z doradcą).

### 2.7. DSA / odpowiedzialność platformy cyfrowej
- Parkownia = **platforma internetowa** (umożliwia zawieranie umów konsument↔host). Obowiązki **bez wyłączenia dla
  mikroprzedsiębiorcy:** regulamin (art. 14), **dwa punkty kontaktowe** (art. 11 dla organów, art. 12 dla użytkowników),
  **notice-and-action** (art. 16-17), zakaz dark patterns, identyfikacja hostów-przedsiębiorców (art. 30 — przy przekroczeniu progu mikro).
- **Wyłączenia dla mikro/małych** (część obowiązków, np. art. 19/29) — udokumentować status (Zalecenie 2003/361/WE:
  <10 osób / <2 mln EUR) + kwartalny przegląd progu.
- **Wyłączenie odpowiedzialności za cudze treści** (DSA art. 4-6 / UŚUDE art. 12-14) działa tylko przy braku wiedzy i
  niezwłocznym usunięciu. **MoR + art. 6 ust. 3 mogą tę tarczę zdjąć** wobec prawa konsumenckiego. Egzekwuje Prezes UKE, kary do 6% obrotu.

---

## 3. Gotowy wzór klauzuli informacyjnej RODO (art. 13) — do formularza leada

> Placeholdery `[...]` uzupełnia klient; całość do przeglądu radcy przed publikacją.

1. **Administrator:** Jakub Bilski, `[adres do doręczeń]`, e-mail: `[privacy@parkownia.com]`.
2. **IOD:** nie wyznaczono; kontakt we wszystkich sprawach danych: `[e-mail]`.
3. **Cele i podstawy:** a) kontakt i działania zmierzające do zawarcia umowy o udostępnianie miejsc — art. 6 ust. 1 lit. b,
   a w zakresie budowy bazy podaży — lit. f; b) geokodowanie adresu obiektu w celu prezentacji na mapie — lit. b/f;
   c) marketing e-mail/SMS — lit. a + odrębna zgoda z art. 398 PKE; d) dochodzenie/obrona roszczeń — lit. f.
4. **Odbiorcy:** hosting (Hetzner Online GmbH, Niemcy), e-mail transakcyjny (pbdevs), bramka SMS (SMSAPI), geokoder
   (Geoapify / OSM Nominatim), magazyn plików (dostawca S3), a na etapie płatności — Stripe.
5. **Transfery poza EOG:** dane mogą trafiać do USA (Stripe; ewent. S3/pbdevs) na podstawie EU-US DPF lub SCC
   (art. 46 ust. 2 lit. c); kopię zabezpieczeń można uzyskać pod `[e-mail]`.
6. **Retencja:** dane leada — do `[X mies.]` od ostatniego kontaktu lub do sprzeciwu; marketing — do cofnięcia zgody;
   roszczenia — do przedawnienia.
7. **Prawa:** dostępu, sprostowania, usunięcia, ograniczenia, przenoszenia, sprzeciwu (wobec lit. f), cofnięcia zgody.
8. **Skarga do Prezesa UODO** (ul. Stawki 2, 00-193 Warszawa).
9. Podanie danych **dobrowolne, lecz niezbędne** do kontaktu i współpracy.
10. Dane **nie służą** zautomatyzowanym decyzjom ani profilowaniu ze skutkiem prawnym (art. 22).

---

## 4. Luki — obszary jeszcze nieprzeanalizowane (do domknięcia)

- **IP warstwy mapowej:** licencja OpenStreetMap (**ODbL** — atrybucja + share-alike), warunki MapLibre, **Nominatim Usage
  Policy** (zakaz masowego geokodowania z publicznego endpointu), warunki Geoapify.
- **Prawo autorskie/wizerunek:** zdjęcia parkingów od hostów (prawa do fotografii, tablice/osoby w kadrze), oświadczenia i licencja.
- **Znak towarowy „Parkownia"** (EUIPO/UPRP), kolizje, ochrona domeny.
- **Dane małoletnich** (art. 8 RODO — 16 lat; DSA art. 28).
- **Status hostów** (podwykonawca/personel vs niezależny) — ryzyko przekwalifikowania relacji.
- **Przepisy lokalne/parkingowe:** tytuł prawny hosta do miejsca (własność/najem/zgoda wspólnoty), MPZP, strefy płatnego
  parkowania Poznania, warunki techniczne (drogi pożarowe, wysokość podziemi). **Realne ryzyko po stronie podaży.**
- **Rozporządzenie P2B 2019/1150** (platforma↔host-przedsiębiorca: regulamin, plasowanie, zawieszenie konta, mediacja).
- **Umowa B2B z hostem:** regres, gwarancja dostępności, kary za double-sell/niewpuszczenie, wymóg OC.
- **Ubezpieczenia:** OC platformy; „ochrona postoju" dla kierowcy → możliwy status pośrednika ubezpieczeniowego.
- **Bezpieczeństwo (art. 32), DPIA (art. 35), IOD (art. 37)** przy pełnym starcie (dane lokalizacyjne + płatności + skala).
- **European Accessibility Act** (dostępność cyfrowa B2C od 28.06.2025 — WCAG/EN 301 549).
- **AML** — zakres własnych obowiązków vs przejęcie przez Stripe.
- **Polityka retencji** zderiwowana z terminów przedawnienia i wymogów podatkowych/DAC7 vs append-only log zgód.

---

## 5. Master-lista pytań do klienta (wg priorytetu)

### A. Blokuje TERAZ (potrzebne, by dokończyć landing zgodnie z prawem)
1. Adres do doręczeń administratora do klauzuli — zamieszkania / wynajęty adres / skrytka?
2. E-mail do spraw danych (np. `privacy@parkownia.com`)?
3. Retencja leadów — jak długo po ostatnim kontakcie (rekom. 12–24 mies.)? Czy część leadów to osoby fizyczne, czy tylko firmy?
4. Jak pozyskujesz właścicieli — **wyłącznie inbound**, czy planujesz też kontakt „na zimno"?
5. Którymi kanałami realnie marketing (e-mail pbdevs? SMS SMSAPI? telefon?) — od tego liczba i treść checkboxów zgód.
6. Czy na landingu będzie analityka/trackery firm trzecich (GA, Meta Pixel, Hotjar)?
7. Geokoder produkcyjny — Nominatim publiczny / Geoapify (DPA) / self-hosted? Gdzie przetwarza (EOG/USA)? Do geokodera sam adres, czy cały rekord?
8. Gdzie hostują i czy dają DPA: pbdevs (mail.pbdevs.com) i dostawca S3?

### B. Przed startem sprzedaży (krytyczne — zacznij nad nimi pracować; nie blokują landingu)
9. **Parkownia STRONĄ umowy (MoR) czy tylko platformą?** (decyzja nadrzędna)
10. **Rejestracja działalności przed sprzedażą — JDG czy sp. z o.o.?** Czy w ostatnich 60 mies. prowadziłeś działalność?
11. Parking **eventowy z datą** czy też **codzienny/abonamentowy**? (przesądza legalność zwrotów)
12. Model **„niestrzeżony" (najem)** czy **„strzeżony" (przechowanie)**? Jak wygląda fizyczny wjazd (host/skaner vs szlaban/kod, kluczyki)?
13. Co przy niewpuszczeniu opłaconego kierowcy — jaka gwarancja (zwrot / miejsce zastępcze / rekompensata)?
14. Polityka 100/50/0% jako „warunki anulowania" czy ustawowe odstąpienie? OC hostów (wszyscy / tylko firmy)? OC platformy?
15. Jak komunikować status hosta (os. prywatna vs przedsiębiorca) kierowcy? Dopuszczasz hostów-konsumentów?
16. Prognoza przychodu prowizyjnego w 1. kwartale i data 1. płatnej rezerwacji? (przesądza moment rejestracji i VAT)
17. Prowizja fakturowana hostowi czy potrącana z płatności? 100% bezgotówkowo (Stripe)?
18. Gotowość zbierać i weryfikować **pola DAC7** i **blokować wypłatę** bez kompletu? Zgoda na info dla hostów o opodatkowaniu + raportowaniu do KAS?
19. Osoba/adres obsługi reklamacji + punktów kontaktowych DSA + notice-and-action? Język regulaminu (PL / PL+EN)?
20. Zlecenie napisania/audytu regulaminu radcy + interpretacja KIS (VAT przy MoR, DAC7)? Budżet na obsługę prawno-księgową?
21. Pozycjonowanie „bezpieczny/pilnowany parking" i/lub produkt „ochrona postoju" dla kierowcy?

### C. Wkrótce
22. Tytuł prawny hosta do miejsca + weryfikacja przeznaczenia terenu (MPZP, strefy, warunki techniczne)?
23. Profilowanie/scoring leadów lub kierowców, kryteria plasowania ofert?
24. Wspólnicy/inwestorzy/sprzedaż udziałów w planach? Monitoring progu mikro (10 osób / 2 mln EUR)?

---

## 6. Kroki natychmiastowe (do zrobienia niezależnie od odpowiedzi)

- Regulamin UŚUDE (art. 8) na landingu, do pobrania przed zapisem leada.
- Pełna klauzula RODO (art. 13, §3) na formularzu + link do polityki prywatności z listą odbiorców i transferów.
- Rozdzielne, niezaznaczone checkboxy zgód (osobno e-mail, osobno SMS/telefon), oddzielone od regulaminu; audyt pod dark patterns.
- **Wstrzymać jakikolwiek cold-mailing/cold-SMS** — wyłącznie inbound.
- Dedykowany `privacy@parkownia.com` + adres do doręczeń administratora.
- Założyć rejestr czynności przetwarzania (RCPD, art. 30).
- Zebrać/zaakceptować DPA: Hetzner, SMSAPI, pbdevs, S3, geokoder + DPA Stripe; ustalić lokalizacje i sub-procesorów.
- Minimalizacja do geokodera (sam adres, bez imienia/telefonu/e-maila); rozważyć self-hosting Nominatim (EOG).
- Mapa transferów poza EOG + TIA + SCC jako podstawa rezerwowa.
- LIA dla art. 6 ust. 1 lit. f + mechanizm „wypisz się"/STOP + suppression list.
- Baner cookie (art. 399 PKE) jeśli trackery — albo info o cookies „niezbędnych".
- **Zaprojektować model danych hosta pod DAC7 już teraz** (pola z §2.6) + blokada wypłaty bez kompletu.
- Udokumentować status mikroprzedsiębiorcy (Zalecenie 2003/361/WE) + kwartalny przegląd progu.
- Umówić: doradcę podatkowego (forma opodatkowania, VAT prowizja vs GMV, DAC7, kasa) + radcę prawnego (forma prawna, audyt regulaminu/polityk pod UOKiK).
- Utrwalić (zrzut/nagranie) label przycisku „zamówienie z obowiązkiem zapłaty" + cenę łączną brutto; test e2e ścieżki zakupu.
- Przygotować (w tle) regulamin DSA art. 14 + punkty kontaktowe (art. 11/12) + formularz notice-and-action.

---

## 7. Źródła (wybór)

**RODO/transfery:** activeMind (DPF a wyrok SN USA), Berkeley Tech Law Journal (Schrems III), Stripe DPA
(`stripe.com/legal/dpa`), Stripe MoR (`docs.stripe.com/connect/merchant-of-record`), gdpr.pl art. 30, UODO
(`uodo.gov.pl/pl/file/708`). **Marketing/PKE:** prawo.pl (PKE — zgoda marketingowa), JAAQOB (art. 398 PKE B2B).
**Konsument:** lexlege (UPK art. 38/17, UŚUDE art. 8), arslege (UPK art. 12a), rejestr.uokik.gov.pl, przykład regulaminu
parkingowego LSF 2025. **Odpowiedzialność:** prawo.pl (kradzież z parkingu), legeartis (parking dozorowany a przechowanie),
lexlege (KC art. 835, 385¹), creativa.legal / sawickilegal (DSA marketplace). **Podatki/DAC7:** MF (`gov.pl/web/finanse`),
ISAP (Dz.U. 2024 poz. 879), Traple, EY, Poradnik Przedsiębiorcy (limity VAT 240k, nierejestrowana 10 813,50 zł, ryczałt najmu, kasa).
