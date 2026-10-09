# Notatki projektu – Generator kart

Plik dla Claude (i ludzi): stan projektu, decyzje i lista pomysłów. Aktualizuj przy każdej większej zmianie.

## Zasady

- **Bez danych gier użytkownika w repozytorium.** Właściciel trzyma swoje projekty gier lokalnie i nie chce ich udostępniać. W repozytorium są tylko generator, dokumentacja i zmyślone przykłady.
- Język: polski (interfejs, komunikaty, komentarze w kodzie, dokumentacja).
- **Tylko aplikacja na Maca (Apple Silicon).** Wersja przeglądarkowa i `Uruchom generator.command` zostały usunięte (decyzja właściciela). Silnik i interfejs to jeden plik `app/generator/karty.html` bez kroku budowania.
- Nowe ikony do przykładów: tylko na wolnej licencji, z wpisem w `CREDITS.md` (game-icons.net = CC BY 3.0, podać autora i link do ikony).
- Zmiany wyglądu kart istniejących projektów muszą być zgodne wstecz. Przed zmianą silnika porównaj zrzuty kart przed/po (różnice tylko w wygładzaniu krawędzi).

## Struktura

```
docs/                      dokumentacja użytkownika
przyklady/NN-nazwa/        przykładowe projekty (Szablony/, CSV, ikony.csv, Ikony/)
CREDITS.md                 autorzy ikon, licencje
app/                       aplikacja na Maca (Electron); app/generator/karty.html = silnik i interfejs
.github/workflows/         budowanie aplikacji na macOS (GitHub Actions)
```

## Aplikacja na Maca (`app/`)

- **`main.js`**:
  - projekt otwiera się przez **plik szablonu** (.txt). Folder projektu to folder szablonu, a gdy szablon leży w `Szablony/` – folder nad nim. Ostatnie projekty z v0.1 (foldery) są zamieniane na pierwszy szablon w `Szablony/`;
  - lokalny serwer (`serwer.js`) na losowym porcie podaje folder projektu; okno ładuje `http://127.0.0.1:port/karty.html?szablon=<ścieżka względna>`;
  - eksport JPG: `eksport:start/plik/koniec` zapisuje do `<projekt>/Export/` (przykłady: pyta o folder);
  - `webRequest.onBeforeRequest` przekierowuje adresy jsDelivr (html-to-image, JSZip, SheetJS) i Google Fonts (EB Garamond + Patrick Hand) na `/.app/vendor/…` i `/.app/fonts/…`, więc aplikacja działa offline. Inne `CZCIONKA_GOOGLE` idą przez internet;
  - menu, ostatnie projekty (`userData/ustawienia.json`), przykłady (z `zasoby/przyklady`, tylko do odczytu);
  - **Nowy projekt…** (⌘N): kopiuje `app/szablon-startowy/` (→ `zasoby/szablon-startowy`) do nowego folderu, podmienia `{{NAZWA}}` i `{{NAZWA_W_CUDZYSLOWIE}}` w `Szablony/gra.txt` i `CZYTAJ.txt`; odmawia, gdy folder istnieje i nie jest pusty. Ikony i obrazek startowy są narysowane na potrzeby projektu (bez licencji zewnętrznych);
  - `pdf:zapisz` → `printToPDF({ preferCSSPageSize: true })`.
- **Edytor szablonu** (w `karty.html`, sekcja „Edytor szablonu”): `<textarea>` z przezroczystym tekstem nad `<pre>` z kolorowaniem (tokenizer liniowy `kolorujLinie`), numery wierszy, lista błędów.
  - Błędy wierszy pochodzą z Uwag (`plik, wiersz N:`) oraz z „brak kolumny [X]” (wiersze z `[X]`).
  - Podgląd na żywo: `podgladNaZywo()` podmienia szablon w `files` i woła `build()`; nowe pliki z szablonu dociąga `loadFromServer({ tylkoNowe: true })`.
  - Stan: `ED.dysk` to ostatnia wersja z dysku. `edytorZDysku()` przy każdym wczytaniu decyduje: brak zmian → tekst z dysku; niezapisane zmiany → tekst edytora i baner konfliktu, gdy dysk się zmienił.
  - Zapis: IPC `edytor:zapisz`. `edytor:zmiany` ustawia `setDocumentEdited`. Main pyta o zapis (`czyMoznaPorzucic`) przy zamknięciu okna, ⌘Q, otwieraniu innego szablonu i nowym projekcie.
  - ⌘S = zapisz szablon, ⇧⌘S = zapisz PDF, ⌥⌘E = edytor.
- **`preload.js`** wystawia `window.generatorApp` (info, otworzSzablon, przyklady, zapiszPdf, eksport…). Bez niego `karty.html` pokazuje tylko informację, że działa w aplikacji.
- **`scripts/zasoby.js`** buduje `app/zasoby/` z `generator/karty.html`, `przyklady/`, bibliotek z `node_modules` i czcionek Fontsource (tylko latin i latin-ext).
- **Tryb testowy** (`--test-edytor` sprawdza też druk 2 zaznaczonych kart, szkic, raport, „tylko zmienione” i historię wersji; zrzuty `-edytor.png`, `-historia.png`): `[--test-nowy <nowy folder>] [--test-edytor] --test-pdf <szablon.txt|folder|-> <wynik.pdf>`. Zapisuje PDF i zrzut ekranu, sprawdza JPG i (poza przykładami) eksport do `Export/`, kończy z kodem 0 albo 1.
  - W tym środowisku testuj na **kopii** przykładu (eksport zapisuje `Export/`): `cd app && npm ci && npm run zasoby && cp -r ../przyklady/03-ogrod /tmp/o && xvfb-run -a ./node_modules/.bin/electron --no-sandbox --user-data-dir=/tmp/ud . --test-pdf /tmp/o /tmp/x.pdf`.
- **Budowanie:** `.github/workflows/aplikacja-mac.yml` (macos-14):
  - tylko Apple Silicon: `electron-builder --mac dir --arm64`, podpis ad hoc `codesign -s -`, testy przykładów (na kopiach) na zbudowanej `.app`, potem `--mac dmg --prepackaged` → `Generator-kart.dmg` (okno z linkiem do Programów), sprawdzenie DMG (`hdiutil attach`, `codesign --verify`), artefakty;
  - push do `main` → wydanie `najnowsza` (`--latest`); README linkuje `releases/latest/download/Generator-kart.dmg`;
  - tag `v*` albo wydanie opublikowane w GitHubie → dołączony DMG.
  - Dependabot (`.github/dependabot.yml`): npm w `app/` co tydzień (Electron osobną grupą), GitHub Actions co miesiąc. html-to-image, JSZip i xlsx są wykluczone, bo ich wersje muszą zgadzać się z adresami CDN w `karty.html`.
  - Sesja Claude nie może tworzyć tagów ani wydań (blokada po stronie GitHuba) – robi to workflow albo właściciel.
  - Brak podpisu Apple Developer i notaryzacji: użytkownik odblokowuje aplikację raz (opis w `docs/aplikacja.md`).
- Wersje: Electron i biblioteki przypięte w `app/package.json`. Wersje bibliotek muszą zgadzać się z adresami CDN w `karty.html` (aplikacja je przekierowuje).

## Architektura `karty.html`

Sekcje w kolejności w pliku:

1. **CSS**: wspólne zasady rysowania (`.karta`, `.el.tekst`, `.el.obrazek`, `.el.ikony`, `.ikona-kolor`), interfejs, `@media print`.
2. **CONFIG**: tylko ustawienia ogólne (folder szablonów, plik ikon, jakość JPG, rozmiar obrazków pcio). Nic, co dotyczy konkretnej gry. Paleta kolorów i plik pokoju pcio są w szablonach (`KOLOR`, `STÓŁ`).
3. **Wczytywanie plików**: `?szablon=` wskazuje szablon. `loadFromServer` pobiera (`fetch`) szablon, potem pliki z `DANE`, literalne pliki z szablonu i `ikony.csv`, a na końcu obrazki z danych. Zmiany wykrywa polling HEAD/Last-Modified co 1,5 s (także pliki wskazane, a jeszcze nieistniejące).
4. **CSV/XLSX**: własny parser CSV (`;`/`,`, BOM, cudzysłowy); XLSX przez SheetJS z CDN.
5. **Ikony**: `ikony.csv` (Znacznik;Znak;Odstęp;Plik;Opis). `renderText()` zamienia `{znacznik}` na `<img>`. Gdy pliku brak, wstawia emoji ze Znak. Obrazki z folderu `Ikony/`/`Icons/` (listing JSON z serwera, `znajdzIkony`) rejestrują się same jako `{nazwa}`; `ikony.csv` je nadpisuje. `{kolor-X}`/`{kolor-X-mix}` (dawniej `{osiag-X}`) to prostokąt w kolorze z palety, rysowany CSS.
6. **Szablony**:
   - `parseTemplate(text, plik)` zwraca `{talie[], pliki, dane, czcionki, google, kolory, stol, bledy}`. Obsługuje sekcje `[TALIA X]`, `[REWERS]`, `[AWERS]`, część wspólną przed pierwszą `[TALIA]`, stan `CZCIONKA` oraz komentarze `;` i `#`.
   - `renderCard(tpl, cmds, row, ctx)` buduje HTML karty: elementy `.el` z pozycją absolutną w mm.
   - Kolumny specjalne `Ilość`, `ID`, `Nazwa` czyta `pole(r, nazwa)` – bez wielkości liter i polskich znaków.
   - Wartości `[Kolumna]`: gwiazdki z danych są maskowane (`\u0001`), żeby nie włączały markdownu.
   - Element znika, gdy wszystkie pola w treści są puste.
   - Stałe: `STAŁA = nazwa, wartość` zbierane przed parsowaniem; `[=nazwa]` podmieniane w argumentach (`wstawStale`) przed `splitArgs`.
   - Pola wbudowane `[_x]` czyta `cell()` z `ctx.wbudowane`; gdy szablon używa `[_numer]`/`[_kopia]`, każda kopia jest renderowana osobno.
   - `jeśli=` porównuje wartości bez względu na wielkość liter, a liczby liczbowo (001 = 1).
7. **Dopasowanie tekstu** (`fitAll`): pole zmniejsza się co 0,04 do `min`. Pola z `grupa=` skalują się razem: wspólna minimalna skala dla całej talii, krok 0,02, a kolizja to odstęp poniżej 2 mm. Pole, które się nie mieści, dostaje klasę `.za-dlugi` (czerwona ramka i uwaga).
8. **Druk** (`buildPrint`):
   - jeden format strony dla całego wydruku (A4 pionowo albo rozmiar karty), bo Safari nie obsługuje nazwanych `@page` i zmniejszał wydruk z mieszanymi formatami;
   - karty poziome są obracane o 90°. Przed obrotem karta musi wystawać w lewo, nie w prawo, inaczej Chrome zmniejsza cały wydruk;
   - siatka jest wyśrodkowana, znaczniki cięcia na marginesie, po każdym arkuszu pełny arkusz rewersów.
9. **Eksport JPG** (do `Export/` przez aplikację; nazwy `Projekt_Talia_ID_kopia.jpg`, rewers `Projekt_Talia_rewers.jpg`, projekt z `PROJEKT =` albo nazwy pliku szablonu): html-to-image `toCanvas`, potem rysowanie na białym tle (żeby zaokrąglone rogi nie wychodziły czarne) i `toBlob('image/jpeg')`. Uwaga: `toBlob` z html-to-image zawsze daje PNG, a opcja `backgroundColor` nadpisywała tło karty.
10. **Eksport playingcards.io** (`exportPcio`):
    - wczytuje `.pcio` (ZIP: `schemaVersion`, `widgets.json`, `userassets/`);
    - dla każdej talii z `PCIO = id` podmienia `cardTypes`, `faceTemplate` i `backTemplate`;
    - karty kładzie zakryte na stosie `deck.parent`, z przesunięciem wziętym z dawnej karty;
    - zachowuje tylko używane `userassets`.

## Testowanie (środowisko Claude)

- Główne narzędzie: tryb testowy aplikacji pod Xvfb (patrz wyżej). Electron z npm pobiera się poprawnie; czcionki i biblioteki są lokalne, więc wynik jest jak na Macu.
- Dokładność druku 1:1: `pdftoppm -r 300` i pomiar znaczników cięcia (odstępy 63,0 / 88,0 mm).
- Zrzuty pojedynczych kart (porównanie przed/po zmianie silnika): Playwright (Chromium w `/opt/pw-browsers`) na `http://127.0.0.1:<port>/karty.html?szablon=…` z serwerem `node -e "require('./app/serwer').utworzSerwer({zasoby:'app/zasoby',projekt:()=>'<folder>'}).listen(8766)"`. CDN jest zablokowany: podmieniaj biblioteki przez `page.route` na pliki z `app/node_modules`.
- Pobieranie artefaktów i wydań GitHuba z tego środowiska nie działa (blob storage zablokowany).
- Błędy JS strony w trybie testowym: `--enable-logging=file --log-file=/tmp/el.log`, potem `grep CONSOLE`. Uwaga: funkcja globalna to też `window.nazwa` – `window.x = () => x()` daje nieskończoną rekurencję (test wisi).
- Przed oddaniem zmiany przejrzyj wszystkie przykłady: zero Uwag i zero błędów strony.

## Pomysły / do zrobienia

1. **Aplikacja na Maca**: pierwsza wersja zrobiona (`app/`). Dalej:
   - automatyczne aktualizacje,
   - wersja na Windows,
   - podpis i notaryzacja Apple (wymaga konta Apple Developer),
   - skojarzenie folderów z aplikacją (przeciąganie na ikonę w Docku).
2. Pola tekstowe z wysokością „auto” (rosnące z treścią do limitu).
3. Edytor – etap 2 (bez decyzji): przesuwanie pól myszką na karcie z zapisem liczb do szablonu; ewentualnie podpowiadanie komend i nazw kolumn.
4. **Spad do druku** (zaplanowane): komenda `SPAD = 3` (mm). Tło i elementy dochodzące do krawędzi wychodzą poza linię cięcia, znaczniki cięcia zostają na linii cięcia. Dotyczy druku A4, pojedynczego i PDF.
5. **Przesunięcie rewersów** (zaplanowane): korekta X/Y w mm arkusza rewersów przy druku dwustronnym (przesunięcie drukarki).

6. **Numer i wersja na karcie** (zrobione, gałąź `claude/noc`): komenda `WERSJA`, pola wbudowane `[_numer]`, `[_kopia]`, `[_liczba]`, `[_id]`, `[_wersja]`, `[_talia]`, `[_projekt]`, `[_data]`; stopka w szablonie startowym.
7. **Drukuj tylko zmienione karty** (zrobione, `claude/noc`): odcisk = `skrot()` (cyrb53) z `htmlKarty()` po `fitAll` (blob: → `plik:ścieżka@mtime:rozmiar`); klucz `talia|ID|kopia`. Zapis po `zapiszPdf` (IPC `druk:odciski`/`druk:zapiszOdciski`, plik `userData/odciski/<sha1 szablonu>.json`, scalany – częściowy wydruk aktualizuje tylko swoje karty). Klasy `.zmieniona`/`.nowa` (box-shadow, zdejmowany w eksporcie JPG), pole „Tylko zmienione” w `kartyDoDruku()`.
8. **Druk wybranych kart** (zrobione, `claude/noc`): klik/Shift+klik w podglądzie (`WYBRANE`, klucz talia|wiersz|kopia, `oznaczKopie`), `kartyDoDruku()` w `buildPrint`; JPG bez zmian.
9. **Tryb szkicu** (zrobione, `claude/noc`): pole „Szkic”, klasa `#druk.szkic` (CSS: bez teł i obrazków, tekst czarny, img w szarościach; bez `filter` na karcie, żeby PDF nie rasteryzował tekstu).
10. **Ikony bez `ikony.csv`** (zrobione, `claude/noc`): każdy obrazek z `Ikony/` (albo `Icons/`) działa jako `{nazwa_pliku}` (też bez polskich znaków); wpis w `ikony.csv` ma pierwszeństwo.
11. **Stałe w szablonie** (zrobione, `claude/noc`): `STAŁA = margines, 3.5` i `[=margines]` w argumentach dowolnej komendy, w całym pliku (kolejność bez znaczenia). Bez działań na liczbach – ewentualnie później.
12. **Arkusz Google jako dane** (zaplanowane): `DANE` z opublikowanego arkusza Google (CSV z linku), wymaga internetu; odświeżanie co jakiś czas.
13. **Raport projektu** (zrobione, `claude/noc`): przycisk „Raport”, `raportProjektu()` na danych z ostatniego `build` (`RAPORT`): duplikaty ID, puste pola używanych kolumn, nieużywane kolumny, ikony (bez znacznika i bez użycia pliku) i obrazki w folderach, do których odwołuje się projekt, oraz `Ikony/`.
14. **Historia wersji** (zrobione, `claude/noc`): `app/historia.js` (zapis, przerzedzanie, stan z chwili, przywrócenie; test `node scripts/test-historia.js` w CI). Renderer po każdym `loadFromServer` (bez `tylkoNowe`) woła `historia:zapisz` z szablonem i plikami CSV/XLSX; pierwsze wczytanie = punkt „otwarcie” (zostaje 10). Panel „Historia” (`pokazHistorie`): różnice LCS (`roznice`, XLSX jako wiersze), `podgladWersji` (podmienia `files`, `PODGLAD_WERSJI` wstrzymuje odświeżanie), `przywrocWersje` (odmowa przy niezapisanych zmianach edytora). Indeks: `.historia/indeks.json` (`wersje[]`, `punkty[]`), kopie w `.historia/pliki/`. Założenia projektu:
    - Przerzedzanie: ostatnia godzina – najwyżej 1 kopia / 5 min, ostatnia doba – 1 / godzinę, miesiąc – 1 / dzień, starsze – 1 / tydzień.
    - Zawsze zostają: stan z otwarcia projektu, stan sprzed przywrócenia, punkty nazwane ręcznie (np. „przed playtestem 3”).
    - Plik → Historia wersji…: lista z datami, różnice linii względem obecnej, „Przywróć” (obecna wersja trafia najpierw do historii), „Pokaż karty z tej wersji”. Obrazków nie kopiujemy.
15. **Obrót elementów** (zrobione, `claude/noc`): `obrót=` dokleja `transform:rotate()` do `box` każdego elementu (wokół środka; `fitAll` mierzy bez obrotu).
16. **Obrys i cień tekstu** (zrobione, `claude/noc`): `obrys=` → `-webkit-text-stroke` (×2, bo `paint-order: stroke fill` chowa połowę), `kolor_obrysu`; `cień` / `cień=kolor` → `text-shadow`.
17. **Gradienty** (zrobione, `claude/noc`): `fillOf()` w `renderCard` – kolory rozdzielone `>` → `linear-gradient(kierunek)`, w `TŁO` i `kolor=` kształtów; `kierunek=` w stopniach (domyślnie 180).
18. **Wiele arkuszy XLSX** (zrobione, `claude/noc`): `plikDanych()` dzieli `gra.xlsx#Arkusz`, `znajdzDane()` zwraca `{name, arkusz}`, `readTable(file, arkusz)` (`'*'` = wszystkie arkusze – do szukania obrazków).
19. **Statystyki talii** (zaplanowane): rozkład wartości kolumn (koszty, kolory, ikony, punkty) z uwzględnieniem kopii, wykresy w panelu jak Raport.
20. **Wizualne porównanie wersji** (zrobione częściowo, `claude/noc`): przycisk „Porównaj” – „przed” (HTML karty zapisany z ostatnim PDF, obrazki w obecnej wersji) i „teraz”. Porównanie z dowolną wersją z historii – razem z pkt 14.
21. **Eksport do Tabletop Simulator** (zaplanowane): arkusze 10×7 kart w JPG (ostatnie pole = rewers ukryty lub osobny plik rewersu), liczba kart na arkusz podana do importu.
22. **Katalog kart do PDF** (zaplanowane): wiele zmniejszonych kart na stronie A4 (np. 4×4 albo 5×5) z podpisami – do przeglądu, instrukcji i dla testerów.
23. **Rozdzielczość eksportu** (zaplanowane): wybór 150/300 dpi i PNG z przezroczystymi rogami (obok JPG).
24. **Skrzynka historii** (zaplanowane): zewnętrzne narzędzie (np. Claude) kładzie `.historia/przychodzace/<data>/` z kopiami plików i `opis.txt`; aplikacja przy najbliższym wczytaniu importuje to jako punkt z opisem (np. „Claude: przed …”) i usuwa folder. Działa też przy zamkniętej aplikacji, bez znajomości formatu `indeks.json`.
25. **Wersja konsolowa (CLI)** (zaplanowane): `generator-kart <polecenie> <szablon.txt>` – ten sam silnik bez okna (Electron z ukrytym oknem; na Linuksie przez Xvfb). Polecenia: `sprawdz` (Uwagi + raport, kod wyjścia ≠ 0 przy błędach, `--json`), `pdf` (opcje jak w pasku: tryb, rewersy, szkic, tylko zmienione, wybrane ID), `jpg`, `png <ID…>` (zrzut wybranych kart do obejrzenia), `historia lista|punkt "opis"|przywroc <czas>` (czysty Node przez `historia.js`, bez Electrona). Cel: Claude edytuje pliki gry w folderze właściciela (powłoka Linux na Macu ma Node 22 i Xvfb), od razu sprawdza wynik i zostawia opisany punkt w historii. Zastępuje obecny tryb `--test-*` (testy CI przejdą na CLI).
26. **`historia punkt` z konsoli** (zaplanowane; prostsza alternatywa dla pkt 24, pierwszy krok pkt 25): `app/historia-cli.js` (~50 linii) na `historia.js`: `punkt <folder projektu> "opis"` (szablony z `Szablony/` + pliki z `DANE`, kopie zmienionych, punkt z opisem, przerzedzanie), `lista`, `przywroc <czas>`. Blokada pliku indeksu (np. `.historia/indeks.lock` z timeoutem) przeciw jednoczesnemu zapisowi z aplikacją. Test w `scripts/test-historia.js`. Użycie przez Claude: skrypt kopiowany do katalogu tymczasowego w powłoce na Macu (Node 22), punkty „Claude: przed …” / „Claude: po …” wokół zmian w plikach gry.

Ustalona kolejność prac: **podejście 2** – spad i przesunięcie rewersów (potem próbny wydruk u właściciela), Podejście 4 (edytor szablonów, etap 1) zrobione w v0.4.0. Podejście 1 (kolumny, rewers w podglądzie, nazwy JPG, DMG, Dependabot) zrobione w v0.2.0, podejście 3 (Nowy projekt…) w v0.3.0. Podejście 2 odłożone (właściciel sprawdzi wydruk później).

### Roadmapa (niski priorytet)

- **Generator stołów playingcards.io**: tworzenie pokoju `.pcio` od zera z opisu w szablonie (np. sekcja `[STÓŁ]`: talie, stosy, pola gry, miejsca graczy, żetony, przyciski tasowania i zbierania), zamiast tylko podmiany talii w istniejącym stole. Obejmuje też wybór talii z istniejącego `.pcio` z listy (zamiast ręcznego `PCIO = id`). Format: ZIP z `schemaVersion` (8), `widgets.json`, `userassets/`; typy widgetów: card, cardDeck, holder, piece, seat, automationButton, hand, labelText.

Kolejność i start każdego zadania ustala właściciel – nie zaczynać bez jego sygnału.
