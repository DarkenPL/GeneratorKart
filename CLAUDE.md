# Notatki projektu – Generator kart

Plik dla Claude (i ludzi): stan projektu, decyzje i lista pomysłów. Aktualizuj przy każdej większej zmianie.

## Zasady

- **Bez danych gier użytkownika w repozytorium.** Właściciel trzyma swoje projekty gier lokalnie i nie chce ich udostępniać. W repozytorium są tylko generator, dokumentacja i zmyślone przykłady.
- Język: polski (interfejs, komunikaty, komentarze w kodzie, dokumentacja).
- **Tylko aplikacja na Maca (Apple Silicon).** Wersja przeglądarkowa i `Uruchom generator.command` zostały usunięte (decyzja właściciela). Silnik i interfejs to jeden plik `app/generator/karty.html` bez kroku budowania.
- Nowe ikony do przykładów: tylko na wolnej licencji, z wpisem w `CREDITS.md` (game-icons.net = CC BY 3.0, podać autora i link do ikony).
- **Wersje:** każda aktualizacja (PR do `main`) podnosi wersję o najmniejszą podwersję w `app/package.json` i `package-lock.json` (0.4.1 → 0.4.2 …) i dopisuje ją w „Zrobione”. Po scaleniu workflow sam publikuje wydanie `v<wersja>` – bez podniesienia wersji wydania nie będzie. Większy skok tylko na prośbę właściciela.
- **Gałęzie:** PR zawsze do `main` (nie łańcuchem do innej gałęzi – po scaleniu bazowej gałęzi GitHub nie przestawił bazy i PR #11 trafił do `claude/noc`). Po scaleniu gałąź można usunąć.
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
  - **Nowy projekt…** (⌘N): kopiuje `app/szablon-startowy/` (z `CLAUDE.md` – kontekst dla Claude; aktualizuj go razem z komendami) (→ `zasoby/szablon-startowy`) do nowego folderu, podmienia `{{NAZWA}}` i `{{NAZWA_W_CUDZYSLOWIE}}` w `Szablony/gra.txt` i `CZYTAJ.txt`; odmawia, gdy folder istnieje i nie jest pusty. Ikony i obrazek startowy są narysowane na potrzeby projektu (bez licencji zewnętrznych);
  - `pdf:zapisz` → `printToPDF({ preferCSSPageSize: true })`.
- **Edytor szablonu** (w `karty.html`, sekcja „Edytor szablonu”): `<textarea>` z przezroczystym tekstem nad `<pre>` z kolorowaniem (tokenizer liniowy `kolorujLinie`), numery wierszy, lista błędów.
  - Błędy wierszy pochodzą z Uwag (`plik, wiersz N:`) oraz z „brak kolumny [X]” (wiersze z `[X]`).
  - Podgląd na żywo: `podgladNaZywo()` podmienia szablon w `files` i woła `build()`; nowe pliki z szablonu dociąga `loadFromServer({ tylkoNowe: true })`.
  - Stan: `ED.dysk` to ostatnia wersja z dysku. `edytorZDysku()` przy każdym wczytaniu decyduje: brak zmian → tekst z dysku; niezapisane zmiany → tekst edytora i baner konfliktu, gdy dysk się zmienił.
  - Zapis: IPC `edytor:zapisz`. `edytor:zmiany` ustawia `setDocumentEdited`. Main pyta o zapis (`czyMoznaPorzucic`) przy zamknięciu okna, ⌘Q, otwieraniu innego szablonu i nowym projekcie.
  - ⌘S = zapisz szablon, ⇧⌘S = okno PDF, ⌘P = okno druku, ⌘E = okno eksportu obrazków, ⌥⌘E = edytor.
- **`preload.js`** wystawia `window.generatorApp` (info, otworzSzablon, przyklady, zapiszPdf, eksport…). Bez niego `karty.html` pokazuje tylko informację, że działa w aplikacji.
- **`scripts/zasoby.js`** buduje `app/zasoby/` z `generator/karty.html`, `przyklady/`, bibliotek z `node_modules` i czcionek Fontsource (tylko latin i latin-ext).
- **Tryb testowy** (`--test-edytor` sprawdza też druk 2 zaznaczonych kart, szkic, raport, „tylko zmienione”, historię wersji ze skrzynką i okna eksportu; poza przykładami też eksport playingcards.io; zrzuty `-edytor.png`, `-historia.png`, `-okno.png`): `[--test-nowy <nowy folder>] [--test-edytor] --test-pdf <szablon.txt|folder|-> <wynik.pdf>`. Zapisuje PDF i zrzut ekranu, sprawdza JPG i (poza przykładami) eksport do `Export/`, kończy z kodem 0 albo 1.
  - W tym środowisku testuj na **kopii** przykładu (eksport zapisuje `Export/`): `cd app && npm ci && npm run zasoby && cp -r ../przyklady/03-ogrod /tmp/o && xvfb-run -a ./node_modules/.bin/electron --no-sandbox --user-data-dir=/tmp/ud . --test-pdf /tmp/o /tmp/x.pdf`.
- **Budowanie:** `.github/workflows/aplikacja-mac.yml` (macos-14):
  - tylko Apple Silicon: `electron-builder --mac dir --arm64`, podpis ad hoc `codesign -s -`, testy przykładów (na kopiach) na zbudowanej `.app`, potem `--mac dmg --prepackaged` → `Generator-kart.dmg` (okno z linkiem do Programów), sprawdzenie DMG (`hdiutil attach`, `codesign --verify`), artefakty;
  - push do `main` → wydanie `v<wersja z app/package.json>` z DMG, `--generate-notes`, `--latest` (tylko gdy takiego wydania jeszcze nie ma; inaczej ostrzeżenie); dawne wydanie `najnowsza` jest usuwane. README linkuje `releases/latest/download/Generator-kart.dmg`;
  - tag `v*` albo wydanie opublikowane w GitHubie → dołączony DMG.
  - Dependabot (`.github/dependabot.yml`): npm w `app/` co tydzień (Electron osobną grupą), GitHub Actions co miesiąc. html-to-image, JSZip i xlsx są wykluczone, bo ich wersje muszą zgadzać się z adresami CDN w `karty.html`.
  - Sesja Claude nie może tworzyć tagów ani wydań (blokada po stronie GitHuba) – robi to workflow albo właściciel.
  - Brak podpisu Apple Developer i notaryzacji: użytkownik odblokowuje aplikację raz (opis w `docs/aplikacja.md`).
- Wersje: Electron i biblioteki przypięte w `app/package.json`. Wersje bibliotek muszą zgadzać się z adresami CDN w `karty.html` (aplikacja je przekierowuje).

## Architektura `karty.html`

Sekcje w kolejności w pliku:

1. **CSS**: wspólne zasady rysowania (`.karta`, `.el.tekst`, `.el.obrazek`, `.el.ikony`, `.ikona-kolor`), interfejs, `@media print`.
2. **CONFIG**: tylko ustawienia ogólne (folder szablonów, plik ikon, domyślna rozdzielczość i jakość JPG). Nic, co dotyczy konkretnej gry. Paleta kolorów jest w szablonach (`KOLOR`).
3. **Wczytywanie plików**: `?szablon=` wskazuje szablon. `build()` kolejkuje przebudowy (`KOLEJKA_BUDOWY` → `zbudujTeraz`), bo równoległe przebudowy unieważniały sobie adresy blob: obrazków; eksporty (JPG, playingcards.io) idą przez `naWylacznosc()`: czekają na trwające przebudowy, a nowe przebudowy czekają na koniec eksportu (`KONIEC_EKSPORTU`); `EKSPORT_TRWA` wstrzymuje też odświeżanie. `loadFromServer` pobiera (`fetch`) szablon, potem pliki z `DANE`, literalne pliki z szablonu i `ikony.csv`, a na końcu obrazki z danych. Zmiany wykrywa polling HEAD/Last-Modified co 1,5 s (także pliki wskazane, a jeszcze nieistniejące); odcisk liczony z posortowanych ścieżek – kolejność pobrań jest losowa.
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
8. **Druk** (`buildPrint(o)` – opcje z okna Druk i PDF):
   - jeden format strony dla całego wydruku (A4 pionowo albo rozmiar karty), bo Safari nie obsługuje nazwanych `@page` i zmniejszał wydruk z mieszanymi formatami;
   - karty poziome są obracane o 90°. Przed obrotem karta musi wystawać w lewo, nie w prawo, inaczej Chrome zmniejsza cały wydruk;
   - siatka jest wyśrodkowana, znaczniki cięcia na marginesie, po każdym arkuszu pełny arkusz rewersów.
9. **Eksport obrazków** (`eksportObrazkow(o)`, JPG/PNG, 150/300 dpi; do `Export/` przez aplikację; nazwy `Projekt_Talia_ID_kopia.jpg|png`, rewers `Projekt_Talia_rewers.jpg`, projekt z `PROJEKT =` albo nazwy pliku szablonu): html-to-image `toCanvas`, potem rysowanie na białym tle (żeby zaokrąglone rogi nie wychodziły czarne) i `toBlob('image/jpeg')`. Uwaga: `toBlob` z html-to-image zawsze daje PNG, a opcja `backgroundColor` nadpisywała tło karty.
10. **Eksport playingcards.io** (`exportPcio`): nowy pokój od zera – ZIP (`schemaVersion` 8, `widgets.json`, `userassets/`); na talię `holder` (label = nazwa talii, karta + ramka 4) z `cardDeck` (`parent` = holder, dłuższy bok karty 160, `faceTemplate` obraz dynamiczny, `backTemplate` obraz rewersu albo kolor + nazwa) i kartami zakrytymi w stosie. Holdery w rzędach (`PCIO` w kodzie: odstęp 40, szerokość stołu 1500). Bez przycisków. Zapis IPC `pcio:zapisz` do `<projekt>/<PROJEKT> – playingcards.pcio` (przykłady: okno zapisu). Komendy `PCIO`/`STÓŁ` dają tylko uwagę (dawny tryb podmiany usunięty).

## Testowanie (środowisko Claude)

- Główne narzędzie: tryb testowy aplikacji pod Xvfb (patrz wyżej). Electron z npm pobiera się poprawnie; czcionki i biblioteki są lokalne, więc wynik jest jak na Macu.
- Dokładność druku 1:1: `pdftoppm -r 300` i pomiar znaczników cięcia (odstępy 63,0 / 88,0 mm).
- Zrzuty pojedynczych kart (porównanie przed/po zmianie silnika): Playwright (Chromium w `/opt/pw-browsers`) na `http://127.0.0.1:<port>/karty.html?szablon=…` z serwerem `node -e "require('./app/serwer').utworzSerwer({zasoby:'app/zasoby',projekt:()=>'<folder>'}).listen(8766)"`. CDN jest zablokowany: podmieniaj biblioteki przez `page.route` na pliki z `app/node_modules`.
- Pobieranie artefaktów i wydań GitHuba z tego środowiska nie działa (blob storage zablokowany).
- Błędy JS strony w trybie testowym: `--enable-logging=file --log-file=/tmp/el.log`, potem `grep CONSOLE`. Uwaga: funkcja globalna to też `window.nazwa` – `window.x = () => x()` daje nieskończoną rekurencję (test wisi).
- Przed oddaniem zmiany przejrzyj wszystkie przykłady: zero Uwag i zero błędów strony.

## Kolejka (do zrobienia)

Numery są stałe (właściciel odwołuje się do nich w rozmowie) – zrobione punkty przechodzą do „Zrobione”, nowe dostają kolejny numer.

1. **Aplikacja – dalszy rozwój** (pomysły):
   - automatyczne aktualizacje,
   - wersja na Windows – **odłożona** (decyzja 9.10.2026; szacunek: jedno podejście, instalator NSIS x64, zadanie CI na `windows-latest`, test na żywym Windows),
   - podpis i notaryzacja Apple (wymaga konta Apple Developer),
   - skojarzenie folderów z aplikacją (przeciąganie na ikonę w Docku).
2. Pola tekstowe z wysokością „auto” (rosnące z treścią do limitu) – pomysł.
3. Edytor – etap 2 (bez decyzji): przesuwanie pól myszką na karcie z zapisem liczb do szablonu; ewentualnie podpowiadanie komend i nazw kolumn.
4. **Spad do druku**: komenda `SPAD = 3` (mm). Tło i elementy dochodzące do krawędzi wychodzą poza linię cięcia, znaczniki cięcia zostają na linii cięcia. Dotyczy druku A4, pojedynczego i PDF. **Czeka na próbny wydruk u właściciela** (razem z pkt 5).
5. **Przesunięcie rewersów**: korekta X/Y w mm arkusza rewersów przy druku dwustronnym (przesunięcie drukarki).
12. **Arkusz Google jako dane**: `DANE` z opublikowanego arkusza Google (CSV z linku), wymaga internetu; odświeżanie co jakiś czas.
19. **Statystyki talii**: rozkład wartości kolumn (koszty, kolory, ikony, punkty) z uwzględnieniem kopii, wykresy w panelu jak Raport.
20. **Porównanie z dowolną wersją z historii** (reszta pkt 20; „przed/teraz” od ostatniego PDF jest zrobione).
21. **Eksport do Tabletop Simulator**: arkusze 10×7 kart w JPG (ostatnie pole = rewers ukryty lub osobny plik rewersu), liczba kart na arkusz podana do importu.
22. **Katalog kart do PDF**: wiele zmniejszonych kart na stronie A4 (np. 4×4 albo 5×5) z podpisami – do przeglądu, instrukcji i dla testerów.
25. **Pełna wersja konsolowa (CLI)** – odłożona: `generator-kart <polecenie> <szablon.txt>` – ten sam silnik bez okna (na Linuksie przez Xvfb). Polecenia: `sprawdz` (Uwagi + raport, kod wyjścia, `--json`), `pdf`, `jpg`, `png <ID…>`. Część z historią zrobiona (pkt 26). Uwaga: w powłoce Linux na Macu właściciela (Ubuntu 22.04 arm64, Node 22, Xvfb, bez roota) Electron nie wystartuje – brak GTK3 i `libXss`, ports.ubuntu.com zablokowane; alternatywa: Chromium bez GTK z npm (np. `@sparticuz/chromium`) + `puppeteer-core`, albo renderowanie w środowisku Claude na kopii plików.

### Roadmapa (niski priorytet)

- **Generator stołów playingcards.io**: pełny stół z opisu w szablonie (np. sekcja `[STÓŁ]`: talie, stosy, pola gry, miejsca graczy, żetony, przyciski tasowania i zbierania). Pierwszy krok – nowy pokój z taliami na stosach – zrobiony (pkt 27). Format: ZIP z `schemaVersion` (8), `widgets.json`, `userassets/`; typy widgetów: card, cardDeck, holder, piece, seat, automationButton, hand, labelText (przykłady pól w pokoju właściciela).

## Zrobione

- **v0.2.0** – podejście 1: kolumny specjalne bez względu na pisownię, rewers w podglądzie, nazwy plików JPG, DMG, Dependabot.
- **v0.3.0** – podejście 3: Nowy projekt… (szablon startowy).
- **v0.4.0** – podejście 4: edytor szablonu, etap 1 (kolorowanie, błędy, podgląd na żywo, zapis).
- **v0.4.1** – nocne zmiany (PR #10) i PR #13:
  - 6. Numer i wersja na karcie: `WERSJA`, pola wbudowane `[_numer]`, `[_kopia]`, `[_liczba]`, `[_id]`, `[_wersja]`, `[_talia]`, `[_projekt]`, `[_data]`; stopka w szablonie startowym.
  - 7. Druk tylko zmienionych kart: odcisk `skrot()` (cyrb53) z `htmlKarty()` po `fitAll` (blob: → `plik:ścieżka@mtime:rozmiar`), klucz `talia|ID|kopia`; zapis po `zapiszPdf` (IPC `druk:odciski`/`druk:zapiszOdciski`, `userData/odciski/<sha1 szablonu>.json`, scalany); klasy `.zmieniona`/`.nowa` (box-shadow, zdejmowany w JPG); pole „Tylko zmienione” w `kartyDoDruku()`.
  - 8. Druk wybranych kart: klik/Shift+klik (`WYBRANE`, klucz talia|wiersz|kopia, `oznaczKopie`), `kartyDoDruku()` w `buildPrint`; JPG bez zmian.
  - 9. Tryb szkicu: `#druk.szkic` (bez teł i obrazków, tekst czarny, img w szarościach; bez `filter` na karcie – PDF nie rasteryzuje tekstu).
  - 10. Ikony z folderu `Ikony/`/`Icons/` bez `ikony.csv` (`{nazwa_pliku}`, też bez polskich znaków); `ikony.csv` ma pierwszeństwo.
  - 11. Stałe: `STAŁA = nazwa, wartość`, `[=nazwa]` w argumentach (w całym pliku); bez działań na liczbach.
  - 13. Raport projektu: `raportProjektu()` na `RAPORT` z ostatniego `build` – duplikaty ID, puste pola używanych kolumn, nieużywane kolumny, ikony i obrazki.
  - 14. Historia wersji: `app/historia.js` (zapis tylko przy zmianie treści, przerzedzanie: godzina – 1/5 min, doba – 1/godz., miesiąc – 1/dzień, starsze – 1/tydz.; punkty: otwarcie (10 ostatnich), przed przywróceniem, nazwane – zostają zawsze). Renderer po `loadFromServer` (bez `tylkoNowe`) woła `historia:zapisz`. Panel `pokazHistorie`: różnice LCS (`roznice`, XLSX jako wiersze), `podgladWersji` (`PODGLAD_WERSJI` wstrzymuje odświeżanie), `przywrocWersje` (odmowa przy niezapisanym edytorze). `.historia/indeks.json` (`wersje[]`, `punkty[]`), kopie w `.historia/pliki/`. Obrazków nie kopiujemy.
  - 15. Obrót elementów: `obrót=` → `transform:rotate()` w `box` (`fitAll` mierzy bez obrotu).
  - 16. Obrys i cień tekstu: `obrys=` → `-webkit-text-stroke` ×2 z `paint-order: stroke fill`; `cień` / `cień=kolor` → `text-shadow`.
  - 17. Gradienty: `fillOf()` – kolory rozdzielone `>` → `linear-gradient(kierunek)` w `TŁO` i `kolor=` kształtów.
  - 18. Arkusze XLSX: `gra.xlsx#Arkusz` (`plikDanych()`, `znajdzDane()`, `readTable(file, arkusz)`; `'*'` = wszystkie arkusze).
  - 20 (część). „Porównaj”: karta „przed” (HTML z ostatniego PDF) i „teraz”.
  - 24. Skrzynka historii: `.historia/przychodzace/<nazwa>/` (kopie plików + `opis.txt`) → punkt z opisem; `historia.sprawdzSkrzynke` w main co 3 s, `historia:zmiana` odświeża panel.
  - 26. Historia z konsoli: `app/historia-cli.js` (`punkt <folder> "opis"`, `lista`, `przywroc <nr>`); blokada `.historia/indeks.lock` (`zBlokada`, stara > 10 s zdejmowana). Użycie przez Claude: skrypt kopiowany do katalogu tymczasowego w powłoce na Macu (Node 22), punkty „Claude: przed …” / „Claude: po …” wokół zmian w plikach gry.
  - 27. Eksport playingcards.io jako nowy pokój (zastąpił podmianę talii; szczegóły w „Architektura”, pkt 10).
  - Poprawki: menu aplikacji (przesłonięta zmienna `szablon` – w v0.4.0 menu było domyślne, bez skrótów), kolejka przebudów i eksporty na wyłączność.
- **v0.4.2** – okna druku i eksportu (pkt 28 i 23):
  - 28. Pasek: `[Edytor] [Historia] [Raport]  Talia ▾ … [Eksport obrazków…]` + wiersz stanu (`.stan`: `#status`, `#zmiany` z Porównaj, `#wybor`). Druk, PDF i playingcards.io tylko w menu Plik (Drukuj… ⌘P, Zapisz PDF… ⇧⌘S, Eksport ▸ Obrazki ⌘E / playingcards.io); menu Widok: Raport, Odśwież (⌘R), „Odświeżaj automatycznie” (checkbox, `ustawienia().auto`, strona: `AUTO_ODSWIEZANIE`).
  - Okna: `<dialog id="okno">`, `otworzOkno(rodzaj, domyślnaAkcja)` → `{akcja, opcje}` | null; rodzaje w `OKNA` (`obrazki`, `druk`, `pcio`), pola w `poleOkna()`. Ustawienia osobno dla szablonu: `USTAWIENIA_OKIEN` ↔ IPC `eksport:ustawienia` / `eksport:zapiszUstawienia` (`userData/eksport/<sha1 szablonu>.json`). Zapamiętany niedostępny wybór (np. „zaznaczone” przy 0) → „wszystkie”.
  - Opcje zamiast pól paska: `kartyEksportu({ktore, pominTalie})`, `buildPrint({uklad, rewersy, szkic, karty})`, `zapiszPdf(o)`, `drukuj(o)`, `eksportObrazkow({dpi, format, ktore, pominTalie, rewersy})`, `exportPcio({dpi, pominTalie})`. Talie wybiera okno (filtr podglądu nie ogranicza eksportu).
  - 23. `obrazKarty(el, {dpi, format})`: JPG na białym tle, PNG z przezroczystymi rogami; 150/300 dpi; ta sama funkcja dla playingcards.io. Numer kopii w nazwie pliku z `data-kopia`.
  - Test (`--test-edytor`, poza przykładami): PNG 300 dpi przez okno, zapamiętanie ustawień, okno druku; zrzut `-okno.png`.
- **v0.4.3** – wydania z numerem wersji tworzone automatycznie po każdym scaleniu do `main` (zamiast nadpisywanego wydania „najnowsza”).
- **v0.4.4** – poprawka: pętla odświeżania (napis „odświeżono” zmieniał się co 1,5 s po pierwszym przeładowaniu, np. po edycji). `serverPaths` ma kolejność zakończenia równoległych pobrań, więc odcisk w `serverStamp()` zależał od kolejności; teraz listy są sortowane, a sprawdzenia nie nakładają się (`SPRAWDZANIE`). Test: `serverStamp()` po odwróceniu `serverPaths` bez zmian i stały napis po edycji (`edytor.spokoj`).
- **v0.4.5** – `app/szablon-startowy/CLAUDE.md`: kontekst dla Claude do prototypów gier (współpraca, struktura projektu, ściąga komend, sprawdzanie w trybie testowym, historia z konsoli, proces prototypu, ograniczenia). Kopiowany przez Nowy projekt…; przy zmianach aplikacji aktualizuj ściągę i sekcję „Ograniczenia”.

Kolejność i start każdego zadania ustala właściciel – nie zaczynać bez jego sygnału.
