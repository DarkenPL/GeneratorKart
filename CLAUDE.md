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
- **`preload.js`** wystawia `window.generatorApp` (info, otworzSzablon, przyklady, zapiszPdf, eksport…). Bez niego `karty.html` pokazuje tylko informację, że działa w aplikacji.
- **`scripts/zasoby.js`** buduje `app/zasoby/` z `generator/karty.html`, `przyklady/`, bibliotek z `node_modules` i czcionek Fontsource (tylko latin i latin-ext).
- **Tryb testowy:** `[--test-nowy <nowy folder>] --test-pdf <szablon.txt|folder|-> <wynik.pdf>`. Zapisuje PDF i zrzut ekranu, sprawdza JPG i (poza przykładami) eksport do `Export/`, kończy z kodem 0 albo 1.
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
5. **Ikony**: `ikony.csv` (Znacznik;Znak;Odstęp;Plik;Opis). `renderText()` zamienia `{znacznik}` na `<img>`. Gdy pliku brak, wstawia emoji ze Znak. `{kolor-X}`/`{kolor-X-mix}` (dawniej `{osiag-X}`) to prostokąt w kolorze z palety, rysowany CSS.
6. **Szablony**:
   - `parseTemplate(text, plik)` zwraca `{talie[], pliki, dane, czcionki, google, kolory, stol, bledy}`. Obsługuje sekcje `[TALIA X]`, `[REWERS]`, `[AWERS]`, część wspólną przed pierwszą `[TALIA]`, stan `CZCIONKA` oraz komentarze `;` i `#`.
   - `renderCard(tpl, cmds, row, ctx)` buduje HTML karty: elementy `.el` z pozycją absolutną w mm.
   - Kolumny specjalne `Ilość`, `ID`, `Nazwa` czyta `pole(r, nazwa)` – bez wielkości liter i polskich znaków.
   - Wartości `[Kolumna]`: gwiazdki z danych są maskowane (`\u0001`), żeby nie włączały markdownu.
   - Element znika, gdy wszystkie pola w treści są puste.
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
- Przed oddaniem zmiany przejrzyj wszystkie przykłady: zero Uwag i zero błędów strony.

## Pomysły / do zrobienia

1. **Aplikacja na Maca**: pierwsza wersja zrobiona (`app/`). Dalej:
   - automatyczne aktualizacje,
   - wersja na Windows,
   - podpis i notaryzacja Apple (wymaga konta Apple Developer),
   - skojarzenie folderów z aplikacją (przeciąganie na ikonę w Docku).
2. Pola tekstowe z wysokością „auto” (rosnące z treścią do limitu).
3. **Edytor szablonów – etap 1** (zaplanowane, czeka na sygnał właściciela): panel edytora w aplikacji obok podglądu.
   - kolorowanie składni szablonu (komendy, [Kolumny], {ikony}, opcje, komentarze),
   - podświetlenie linii z błędami (te same komunikaty co w Uwagach),
   - zapis ⌘S i podgląd kart na żywo podczas pisania,
   - ochrona przed utratą pracy: pytanie o niezapisane zmiany przy zamykaniu i zmianie projektu, wykrywanie zmiany pliku na dysku.
   - Etap 2 (bez decyzji): przesuwanie pól myszką na karcie z zapisem liczb do szablonu.
4. **Spad do druku** (zaplanowane): komenda `SPAD = 3` (mm). Tło i elementy dochodzące do krawędzi wychodzą poza linię cięcia, znaczniki cięcia zostają na linii cięcia. Dotyczy druku A4, pojedynczego i PDF.
5. **Przesunięcie rewersów** (zaplanowane): korekta X/Y w mm arkusza rewersów przy druku dwustronnym (przesunięcie drukarki).

Ustalona kolejność prac: **podejście 2** – spad i przesunięcie rewersów (potem próbny wydruk u właściciela), **podejście 4** – edytor szablonów. Podejście 1 (kolumny, rewers w podglądzie, nazwy JPG, DMG, Dependabot) zrobione w v0.2.0, podejście 3 (Nowy projekt…) w v0.3.0. Podejście 2 odłożone (właściciel sprawdzi wydruk później).

### Roadmapa (niski priorytet)

- **Generator stołów playingcards.io**: tworzenie pokoju `.pcio` od zera z opisu w szablonie (np. sekcja `[STÓŁ]`: talie, stosy, pola gry, miejsca graczy, żetony, przyciski tasowania i zbierania), zamiast tylko podmiany talii w istniejącym stole. Obejmuje też wybór talii z istniejącego `.pcio` z listy (zamiast ręcznego `PCIO = id`). Format: ZIP z `schemaVersion` (8), `widgets.json`, `userassets/`; typy widgetów: card, cardDeck, holder, piece, seat, automationButton, hand, labelText.

Kolejność i start każdego zadania ustala właściciel – nie zaczynać bez jego sygnału.
