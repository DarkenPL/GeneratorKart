# Notatki projektu – KarKa (Kawia Karciana, dawniej Generator kart)

Plik dla Claude (i ludzi): stan projektu, decyzje i lista pomysłów. Aktualizuj przy każdej większej zmianie.

## Sposób pracy sesji (przeczytaj najpierw)

Wnioski z porównania sesji z 9–11.10.2026 (łączone PR-y, kolizja wersji, nazwy talii właściciela w dokumentacji). Nad projektem pracuje równolegle kilka sesji Claude.

- **Przed startem:** sprawdź otwarte PR-y i gałęzie (`gh api repos/DarkenPL/KarKa/pulls?state=open`, `git branch -r`). Gdy inna sesja pracuje nad tym samym punktem – zapytaj właściciela, nie rób tego drugi raz.
- **Start zadania tylko na wyraźny sygnał** („zrób”, „startuj”). „Dopisz do kolejki” = tylko wpis. Prośba o plik lokalny ≠ zmiana w repozytorium (PR #18).
- **Jedno zadanie = jedna gałąź z aktualnego `origin/main` = jeden PR.** Nigdy PR zawierający inny niescalony PR (#20 ⊃ #19, #23 ⊃ #22 – właściciel zamykał duplikaty). Gdy nowe zadanie wymaga niescalonego PR-a – poczekaj na scalenie albo zapytaj.
- **Wersja:** dopiero po sprawdzeniu `main` i otwartych PR-ów – kolejna wolna podwersja (0.4.8 była w dwóch PR-ach naraz).
- **Przed każdym commitem:** przejrzyj `git diff --cached` pod kątem nazw z gier właściciela (talie, karty, postacie, nazwy projektów i folderów). W dokumentacji i testach tylko nazwy z `przyklady/`.
- **Testy sprawdzają wygląd, nie tylko istnienie pliku:** obejrzyj wynik (zrzut, katalog, strona PDF), zanim powiesz „działa”. Błąd czcionek w JPG przetrwał od v0.4.2 do v0.4.9, bo test sprawdzał tylko, czy JPG powstał.
- **Wszystko po polsku** – także krótkie zdania robocze między narzędziami.
- **Krótkie sesje:** jedno zadanie na sesję, start od tego pliku. Bardzo długie sesje gubią zasady po streszczeniu kontekstu. Nowe wnioski dopisuj tutaj albo w „Jak pracować szybko”.
- `pkill -f` / `pgrep -f` z wzorcem, który występuje w tym samym poleceniu, zabija własną powłokę – zabijaj procesy osobnym poleceniem albo po PID.

## Zasady

- **Bez danych gier użytkownika w repozytorium.** Właściciel trzyma swoje projekty gier lokalnie i nie chce ich udostępniać. W repozytorium są tylko generator, dokumentacja i zmyślone przykłady.
- Język: polski (interfejs, komunikaty, komentarze w kodzie, dokumentacja).
- **Tylko aplikacja na Maca (Apple Silicon).** Wersja przeglądarkowa i `Uruchom generator.command` zostały usunięte (decyzja właściciela). Silnik i interfejs to jeden plik `app/generator/karty.html` bez kroku budowania.
- Nowe ikony do przykładów: tylko na wolnej licencji, z wpisem w `CREDITS.md` (game-icons.net = CC BY 3.0, podać autora i link do ikony).
- **Wersje:** każda aktualizacja (PR do `main`) podnosi wersję o najmniejszą podwersję w `app/package.json` i `package-lock.json` (0.4.1 → 0.4.2 …) i dopisuje ją w „Zrobione”. Po scaleniu workflow sam publikuje wydanie `v<wersja>` – bez podniesienia wersji wydania nie będzie. Większy skok tylko na prośbę właściciela. Seria wydań ma nazwę: `nazwaWydania` w `app/package.json` (0.5.x – „Gołąb pocztowy”); trafia do tytułu wydania i okna „O aplikacji”. Nową nazwę wymyśla się (z właścicielem) tylko przy większym skoku wersji.
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
  - **Nowy projekt…** (⌘N): kopiuje `app/szablon-startowy/` (→ `zasoby/szablon-startowy`) do nowego folderu, podmienia `{{NAZWA}}` i `{{NAZWA_W_CUDZYSLOWIE}}` w `Szablony/gra.txt` i `CZYTAJ.txt`; odmawia, gdy folder istnieje i nie jest pusty. Ikony i obrazek startowy są narysowane na potrzeby projektu (bez licencji zewnętrznych);
  - `pdf:zapisz` → `printToPDF({ preferCSSPageSize: true })`.
- **Edytor szablonu** (w `karty.html`, sekcja „Edytor szablonu”): `<textarea>` z przezroczystym tekstem nad `<pre>` z kolorowaniem (tokenizer liniowy `kolorujLinie`), numery wierszy, lista błędów.
  - Błędy wierszy pochodzą z Uwag (`plik, wiersz N:`) oraz z „brak kolumny [X]” (wiersze z `[X]`).
  - Podgląd na żywo: `podgladNaZywo()` podmienia szablon w `files` i woła `build()`; nowe pliki z szablonu dociąga `loadFromServer({ tylkoNowe: true })`.
  - Stan: `ED.dysk` to ostatnia wersja z dysku. `edytorZDysku()` przy każdym wczytaniu decyduje: brak zmian → tekst z dysku; niezapisane zmiany → tekst edytora i baner konfliktu, gdy dysk się zmienił.
  - Zapis: IPC `edytor:zapisz`. `edytor:zmiany` ustawia `setDocumentEdited`. Main pyta o zapis (`czyMoznaPorzucic`) przy zamknięciu okna, ⌘Q, otwieraniu innego szablonu i nowym projekcie.
  - ⌘S = zapisz szablon, ⇧⌘S = okno PDF, ⌘P = okno druku, ⌘E = okno eksportu obrazków, ⌥⌘E = edytor.
- **Aktualizacje** (v0.5.0; opis dla użytkownika: `docs/aplikacja.md`, „Aktualizacje”):
  - `package.json` → `main: start.js` (**rozrusznik**, zmienia się tylko z pełną aktualizacją – trzymać prosty). `nakladka.js` `wybierzNakladke(<userData>/kod)`: nakładka tylko gdy `nakladka.json.electron === process.versions.electron` i wersja > wbudowanej; znacznik `start-<wersja>` przed startem, `potwierdzStart()` (did-finish-load) go usuwa, zastany znacznik → plik `zepsuta` i start z paczki; wyjątek przy `require` nakładki → `zepsuta` + `app.relaunch()`. `global.GENERATOR_KOD` → w main `KOD`, `WERSJA` (zamiast `app.getVersion()`), `ZASOBY` obok kodu albo w `Resources`; `FOLDERY_PRZYKLADOW` – przykłady z paczki i nakładki tylko do odczytu. `--bez-nakladki`.
  - `aktualizacje.js`: `sprawdz` (`releases/latest` + `aktualizacja.json`; `GENERATOR_KART_AKTUALIZACJE` = inny adres – testy), `rodzaj` `kod` gdy ten sam Electron, inaczej `pelna`; `pobierz` (SHA-256), `zainstalujKod` (ditto/unzip → `kod-nowy` → `kod`), `przygotujPelna` (ZIP `.app`, `codesign --verify`), `zaplanujPodmiane` (skrypt bash czeka na pid, `mv` z zapasem, `xattr -dr`, `open`), `moznaPodmienic`. W main: `net.fetch`, `sprawdzAktualizacje({cicho})` (start po 4 s – nie w trybie testowym; menu „Sprawdź aktualizacje…”; `ustawienia().pominWersje`), `zainstalujAktualizacje`, `zrestartuj`, `will-quit` → podmiana bez restartu, `zlecenieAktualizacji()` (plik `aktualizacja`, `instaluj`, `restart`; wynik przed restartem).
  - Wydanie (workflow): `KarKa.dmg` + `KarKa.zip` (ditto `--keepParent`) + `kod.zip` i `aktualizacja.json` (`scripts/paczka-kodu.js`: `build.files` bez `start.js` + `zasoby/`). Nowy plik kodu w `app/` → dopisać do `build.files`, inaczej nie trafi ani do paczki, ani do nakładki.
  - Testy: `scripts/test-aktualizacje.js` (serwer udający GitHuba; `--electron`: zlecenie instaluje nakładkę, następny start z nakładki – `--test-aktualizacja`), w CI także nakładka w zbudowanej `.app`. Wynik trybu testowego ma `kod: { zrodlo, wersja }`.
- **`preload.js`** wystawia `window.generatorApp` (info, otworzSzablon, przyklady, zapiszPdf, eksport…). Bez niego `karty.html` pokazuje tylko informację, że działa w aplikacji.
- **`scripts/zasoby.js`** buduje `app/zasoby/` z `generator/karty.html`, `przyklady/`, bibliotek z `node_modules` i czcionek Fontsource (tylko latin i latin-ext).
- **Przykłady:** 01 wyprawa (podstawy), 02 kuźnia (ikony, `grupa=`), 03 ogród (dwie talie, karta pozioma, `jeśli=`), 04 karawana (XLSX z dwoma arkuszami, `STAŁA`, gradienty, `ELIPSA`/`krycie`, `obrót`, `LINIA`, `styl_obwódki`, `WERSJA` + pola wbudowane, `Ilość = 0`), 05 zaklęcia (karty 44×68, CSV z `,`, `obrys`/`cień`, flagi tekstu, `{kolor-…}` z polskimi nazwami, `jeśli=` z `!=`, `KARTA` w `[REWERS]`, `[AWERS]`). Uwaga: `**…**` działa tylko w tekście szablonu – gwiazdki z danych są maskowane. Ikony: game-icons.net z repo `game-icons/icons` (git clone działa), czarne tło usunięte, kolor zmieniony, wpis w `CREDITS.md`.
- **Tryb testowy** (`--test-edytor` sprawdza też druk 2 zaznaczonych kart, szkic, raport, „tylko zmienione”, historię wersji ze skrzynką i okna eksportu; poza przykładami też eksport playingcards.io; zrzuty `-edytor.png`, `-historia.png`, `-okno.png`): `[--test-nowy <nowy folder>] [--test-edytor] --test-pdf <szablon.txt|folder|-> <wynik.pdf>`. Zapisuje PDF i zrzut ekranu, sprawdza JPG i (poza przykładami) eksport do `Export/`, kończy z kodem 0 albo 1.
  - W tym środowisku testuj na **kopii** przykładu (eksport zapisuje `Export/`): `cd app && npm ci && npm run zasoby && cp -r ../przyklady/03-ogrod /tmp/o && xvfb-run -a ./node_modules/.bin/electron --no-sandbox --user-data-dir=/tmp/ud . --test-pdf /tmp/o /tmp/x.pdf`.
- **Budowanie:** `.github/workflows/aplikacja-mac.yml` (macos-14):
  - tylko Apple Silicon: `electron-builder --mac dir --arm64`, podpis ad hoc `codesign -s -`, testy przykładów (na kopiach) na zbudowanej `.app`, potem `--mac dmg --prepackaged` → `KarKa.dmg` (okno z linkiem do Programów), sprawdzenie DMG (`hdiutil attach`, `codesign --verify`), artefakty;
  - push do `main` → wydanie `v<wersja z app/package.json>` z DMG, `--generate-notes`, `--latest` (tylko gdy takiego wydania jeszcze nie ma; inaczej ostrzeżenie); dawne wydanie `najnowsza` jest usuwane. README linkuje `releases/latest/download/KarKa.dmg`;
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
   - `o.ciecie`: `znaczniki` (na marginesie) | `nozyczki` (`.linia-ciecia` – przerywana ramka 0,2 mm wokół każdej karty) | `oba`; arkusz rewersów bez linii;
   - układ `drukarnia`: jak `pojedyncze` (strona na kopię, awers/rewers na przemian), strona = karta + 2×`o.spad` (domyślnie 2 mm), bez znaczników. `kartaZeSpadem(k, w, h, s)`: klon karty powiększony o spad, zawartość w wewnętrznym divie przesuniętym o spad, bez `border-radius`; prostokąty i obrazki cover/fill dotykające krawędzi (tolerancja 0,05 mm, bez obrotu i zaokrągleń) są przedłużane o spad. RGB (CMYK – pkt 34).
9. **Czcionki w obrazkach** (`cssCzcionek()`, od v0.4.9): html-to-image nie umiał pobrać czcionek (arkusz Google przekierowany na `/.app/fonts/fonts.css` – reguły nieczytelne, fetch bez CORS), więc JPG/PNG/pcio/katalog wychodziły czcionką zastępczą. Teraz `fontEmbedCSS` budowany sam: `/.app/fonts/fonts.css` + `#czcionki-szablonow` (CZCIONKA_PLIK, blob:) + inne linki Google (fetch z internetu, bez cyrylicy/greki…), url → data:, cache wg klucza. Test: `czcionki` w trybie testowym.
   **Eksport obrazków** (`eksportObrazkow(o)`, JPG/PNG, 150/300 dpi; do `Export/` przez aplikację; nazwy `Projekt_Talia_ID_kopia.jpg|png`, rewers `Projekt_Talia_rewers.jpg`, projekt z `PROJEKT =` albo nazwy pliku szablonu): html-to-image `toCanvas`, potem rysowanie na białym tle (żeby zaokrąglone rogi nie wychodziły czarne) i `toBlob('image/jpeg')`. Uwaga: `toBlob` z html-to-image zawsze daje PNG, a opcja `backgroundColor` nadpisywała tło karty.
10. **Eksport playingcards.io** (`exportPcio`): nowy pokój od zera – ZIP (`schemaVersion` 8, `widgets.json`, `userassets/`); na talię `holder` (label = nazwa talii, karta + ramka 4) z `cardDeck` (`parent` = holder, dłuższy bok karty 160, `faceTemplate` obraz dynamiczny, `backTemplate` obraz rewersu albo kolor + nazwa) i kartami zakrytymi w stosie. Holdery w rzędach (`PCIO` w kodzie: odstęp 40, szerokość stołu 1500). Bez przycisków. Zapis IPC `pcio:zapisz` do `<projekt>/<PROJEKT> – playingcards.pcio` (przykłady: okno zapisu). Komendy `PCIO`/`STÓŁ` dają tylko uwagę (dawny tryb podmiany usunięty).

11. **Katalog talii** (`katalogPng(o)` → `zapiszKatalog(o, cel)`): JPG (jakość 0,9) na talię – najpierw rewers (niebieska ramka, podpis „Rewers”; pomijany przy filtrze `id`), potem awersy, każda karta raz (wg `data-row`, podpis „ID Nazwa ×kopie” z `title`), miniatury przez `obrazKarty` (`KATALOG.dpi` 110, render 2×), strona ≤ ~2000×2000 px (więcej kart → `_1`, `_2`…), czerwona ramka przy `.za-dlugi`; filtr podglądu zdejmowany na czas eksportu. Cel `katalog` → `Export/katalog/` (Plik → Eksport → Katalog talii, okno `katalog`); cel `zlecenie` → `.generator/katalog/` (czyszczony). **Zlecenia:** main co 3 s (`sprawdzZlecenia`) szuka pliku `.generator/zlecenia/katalog` (opcjonalnie `talie = …`, `id = …`), woła `zlecenieKatalogu(opcje)`, usuwa zlecenie, potem zapisuje `.generator/zlecenia/wynik.json` (`ok`, `pliki`, `talie[{nazwa, pliki, karty, zaDlugie}]`, `uwagi`, `zaDlugie`, `niezapisaneZmiany`). Użycie przez Claude: utworzyć plik zlecenia w powłoce na Macu, czekać na `wynik.json`, obejrzeć PNG (stage do kontenera).
12. **Raport – rozdzielczość obrazków** (`obrazkiNiskiejRozdzielczosci`): `OBRAZEK` (wg `object-fit`) i `TŁO` z pliku (cover), SVG pomijane, próg 300 dpi.
13. **`LINIA`** (`liniaSvg`): SVG na całą kartę (`overflow:visible`), groty rysowane geometrią (nie `<marker>` – znikały, gdy pierwsza definicja była w ukrytej talii); `styl_obwódki` dla `PROSTOKĄT`/`ELIPSA`.
14. **Zlecenia z pliku** (pkt 35, v0.4.11): main `sprawdzZlecenia` co 3 s przegląda `.generator/zlecenia/<polecenie>` (`POLECENIA`: katalog, stan, raport, pdf, obrazki, pcio – po kolei, jedno naraz, `zlecenieTrwa`), czeka na `window.zbudowano` (pierwsza przebudowa), `czytajZlecenie` → surowe `klucz = wartość`, woła `wykonajZlecenie(polecenie, surowe)`, usuwa plik i zapisuje `wynik-<polecenie>.json` (katalog też `wynik.json`); ścieżki w `pliki` względne. Strona: `opcjeZlecenia` (klucze bez wielkości liter i polskich znaków, aliasy `ALIASY_ZLECEN`, wartości sprawdzane – błąd = `ok:false`, nieznany klucz/ID = `ostrzezenia`; brak klucza = `OKNA[…].domyslne` + `USTAWIENIA_OKIEN`, bez zapisu), `ZADANIA_ZLECEN` (pdf → `zapiszPdf({zlecenie})` → IPC `zlecenie:pdf` bez okna, tylko w projekcie i w trakcie zlecenia; obrazki → `eksportObrazkow({zlecenie})` bez Findera; pcio; raport → `raportJson()` z HTML raportu; stan → `stanKart()` – nazwa karty z `title` bez prefiksu talii i ID, żeby nie zmieniać HTML kart i odcisków). `kartyEksportu` ma `talie`/`id`. Niezapisany edytor: `ZLECENIE_Z_DYSKU` (edytorZDysku zwraca dysk) + `loadFromServer()`, potem `podgladNaZywo()`; `ZLECENIE_TRWA` wstrzymuje automatyczne odświeżanie. Test: `zlecenia` w `--test-edytor`.

## Testowanie (środowisko Claude)

- **Najszybciej: `app/scripts/testuj.sh`** – przebudowuje `zasoby`, sprawdza składnię `main.js`/`preload.js`/`karty.html` i uruchamia `--test-edytor` na kopiach wszystkich przykładów **naraz** (≈ 1,5 min; po kolei było > 5 min). Jeden przykład w trakcie pracy: `scripts/testuj.sh 03-ogrod` (≈ 45 s). Dowolny projekt: `scripts/testuj.sh <…>/Szablony/gra.txt` (kopiuje cały folder projektu). `BEZ_EDYTORA=1` – szybki test bez `--test-edytor`. Wynik: wiersz na projekt + kod 0/1, pliki w `/tmp/gk-testy`.
- Główne narzędzie: tryb testowy aplikacji pod Xvfb (patrz wyżej). Electron z npm pobiera się poprawnie; czcionki i biblioteki są lokalne, więc wynik jest jak na Macu.
- Dokładność druku 1:1: `pdftoppm -r 300` i pomiar znaczników cięcia (odstępy 63,0 / 88,0 mm).
- Zrzuty pojedynczych kart (porównanie przed/po zmianie silnika): Playwright (Chromium w `/opt/pw-browsers`) na `http://127.0.0.1:<port>/karty.html?szablon=…` z serwerem `node -e "require('./app/serwer').utworzSerwer({zasoby:'app/zasoby',projekt:()=>'<folder>'}).listen(8766)"`. CDN jest zablokowany: podmieniaj biblioteki przez `page.route` na pliki z `app/node_modules`.
- Pobieranie artefaktów i wydań GitHuba z tego środowiska nie działa (blob storage zablokowany).
- Błędy JS strony w trybie testowym: `--enable-logging=file --log-file=/tmp/el.log`, potem `grep CONSOLE`. Uwaga: funkcja globalna to też `window.nazwa` – `window.x = () => x()` daje nieskończoną rekurencję (test wisi).
- Przed oddaniem zmiany przejrzyj wszystkie przykłady: zero Uwag i zero błędów strony.

## Jak pracować szybko (wnioski z poprzednich sesji)

Właściciel zwraca uwagę na czas pracy – mniej czekania, mniej czytania na ślepo.

**Start sesji**
- `git clone --depth 1` → `cd app && npm ci && npm run zasoby` (≈ 1 min). Mapa `karty.html` (≈ 2300 wierszy): `grep -n "^async function\|^function\|^const [A-Z_]* =" app/generator/karty.html`; opis sekcji – „Architektura” wyżej. Czytaj tylko potrzebne fragmenty.
- Płytki klon ma w `remote.origin.fetch` tylko `main` – po wypchnięciu własnej gałęzi `git status` nie widzi jej na serwerze i hook zgłasza „unpushed commit”. Od razu po `git push -u`: `git config --add remote.origin.fetch '+refs/heads/<gałąź>:refs/remotes/origin/<gałąź>' && git fetch -q origin`.
- `gh pr list` nie działa (GraphQL zablokowany) – tylko REST: `gh api repos/DarkenPL/KarKa/pulls …`.

**Pętla pracy**
- Test uruchamia kopię `app/zasoby/karty.html`, nie `app/generator/karty.html` – po każdej zmianie `npm run zasoby` (robi to `scripts/testuj.sh`). Zapomniane = test starego kodu.
- Nowa funkcja = nowy blok w `trybTestowy` (`main.js`) przed `await wc.executeJavaScript('buildPrint()')`, dopisany do `ok` i do JSON-a na końcu. Wzór: bloki `katalog`, `zlecenia`.
- Tekst dopisany w teście na koniec szablonu trafia do ostatniej sekcji (w 02-kuznia to `[REWERS]`) – zmieniając karty w teście, celuj w konkretną sekcję albo w wiersz `PROJEKT =` (komentarz `;` za wartością!).
- **Nie zmieniaj atrybutów ani struktury HTML kart** (`renderCard`, `data-*`, `title`) bez potrzeby: odcisk karty (`htmlKarty`) to jej HTML, więc po aktualizacji aplikacji wszystkie karty u właściciela byłyby „zmienione od ostatniego PDF”. Brakujące dane bierz z istniejących atrybutów (np. nazwa z `title`).
- Błędy, które już raz kosztowały czas: `window.x = () => x()` (rekurencja, test wisi); zmienna lokalna o nazwie globalnej `szablon` w `main.js` (v0.4.0 – ReferenceError, domyślne menu); eksport bez `naWylacznosc()` (losowo padał co kilka przebiegów); odcisk plików z nieposortowanej listy (pętla odświeżania, v0.4.4); `html-to-image` bez `fontEmbedCSS` (czcionka zastępcza, v0.4.9).

**CI i PR**
- Workflow macOS trwa ≈ 8–10 min. Nie czekaj na niego bezczynnie w pętli: otwórz PR, napisz właścicielowi wynik testów lokalnych, a CI sprawdź raz na końcu (`gh api "repos/DarkenPL/KarKa/actions/runs?branch=<gałąź>&per_page=1" --jq '.workflow_runs[0]|.status+" "+(.conclusion//"")'`). Gdy padnie: `…/actions/runs/<id>/jobs` → `…/actions/jobs/<id>/logs`.
- Drobna poprawka do otwartego, niescalonego PR-a = commit na tę samą gałąź (bez nowego podbicia wersji).

**Praca na Macu właściciela (podłączone foldery)**
- Foldery gier są w powłoce na Macu pod `$HOME/mnt/<Folder>` (Ubuntu, Node 22, bez Electrona, bez sieci do GitHuba). Usuwanie plików jest tam domyślnie zablokowane.
- `historia-cli.js` zostawia `.historia/indeks.lock`, którego bez zgody na usuwanie nie da się skasować (następny punkt czeka). Jeśli planujesz punkty historii – na początku poproś raz o zgodę na usuwanie w folderze gry (`device_request_delete_permission`). Skrypty (`historia.js` + `historia-cli.js`) przenieś do `$HOME/hist` (np. `base64` + `tar` w poleceniu).
- Kopia projektu do testu u siebie: `device_stage_files` (do 50 plików na wywołanie; pliki lądują w `/mnt/user-data/uploads/<Folder>/…`), bez `*.indd`, `*.pdf`, `Export/`, `.historia/`, `.generator/`. Potem `scripts/testuj.sh /mnt/user-data/uploads/<Folder>/Szablony/gra.txt`. Danych gier nie kopiuj do repozytorium.
- Gdy aplikacja właściciela jest otwarta na projekcie (od v0.4.11), PDF/obrazki/raport/stan rób **zleceniami z pliku** (`docs/aplikacja.md`, „Zlecenia z pliku”) – wynik jest z jego wersji aplikacji, bez kopiowania plików. Zlecenia wykonują się tylko w wersji, która je zna: przy braku `wynik-<polecenie>.json` po ~10 s sprawdź wersję aplikacji (`wersjaAplikacji` w `wynik-stan.json` albo zapytaj).

## Kolejka (do zrobienia)

Numery są stałe (właściciel odwołuje się do nich w rozmowie) – zrobione punkty przechodzą do „Zrobione”, nowe dostają kolejny numer.

1. **Aplikacja – dalszy rozwój** (pomysły):
   - wersja na Windows – **odłożona** (decyzja 9.10.2026; szacunek: jedno podejście, instalator NSIS x64, zadanie CI na `windows-latest`, test na żywym Windows),
   - podpis i notaryzacja Apple (wymaga konta Apple Developer),
   - skojarzenie folderów z aplikacją (przeciąganie na ikonę w Docku).
2. Pola tekstowe z wysokością „auto” (rosnące z treścią do limitu) – pomysł.
3. Edytor – etap 2 (bez decyzji): przesuwanie pól myszką na karcie z zapisem liczb do szablonu; ewentualnie podpowiadanie komend i nazw kolumn.
4. **Spad w druku A4** (reszta pkt 4): spad jest już w układzie „Drukarnia” (pkt 33, `kartaZeSpadem`); w A4 i „osobnych stronach” – do decyzji (komenda `SPAD` albo pole w oknie). **Czeka na próbny wydruk u właściciela** (razem z pkt 5).
5. **Przesunięcie rewersów**: korekta X/Y w mm arkusza rewersów przy druku dwustronnym (przesunięcie drukarki; drukarka właściciela odwraca wzdłuż dłuższej krawędzi).
12. **Arkusz Google jako dane**: `DANE` z opublikowanego arkusza Google (CSV z linku), wymaga internetu; odświeżanie co jakiś czas.
19. **Statystyki talii**: rozkład wartości kolumn (koszty, kolory, ikony, punkty) z uwzględnieniem kopii, wykresy w panelu jak Raport.
20. **Porównanie z dowolną wersją z historii** (reszta pkt 20; „przed/teraz” od ostatniego PDF jest zrobione).
21. **Eksport do Tabletop Simulator**: arkusze 10×7 kart w JPG (ostatnie pole = rewers ukryty lub osobny plik rewersu), liczba kart na arkusz podana do importu.
22. **Katalog kart do PDF** (reszta): strony A4 ze zmniejszonymi kartami i podpisami – do instrukcji i dla testerów; katalog JPG jest zrobiony (pkt 30, `katalogPng`). Makieta (11.10.2026, decyzja właściciela: A4, projekt ~156 kart na 2 stronach): każda karta raz z „×kopie”, talie po kolei od rewersu (niebieska ramka), „(ciąg dalszy)” przy przejściu strony, nagłówek z nazwą projektu, numerem strony i datą; liczba stron = ⌈pozycje / 78⌉, skala automatyczna – największa (≤ 60%), przy której mieści się w tej liczbie stron. Czeka na akceptację makiety.
25. **Pełna wersja konsolowa (CLI)** – odłożona: `generator-kart <polecenie> <szablon.txt>` – ten sam silnik bez okna (na Linuksie przez Xvfb). Polecenia: `sprawdz` (Uwagi + raport, kod wyjścia, `--json`), `pdf`, `jpg`, `png <ID…>`. Część z historią zrobiona (pkt 26). Uwaga: w powłoce Linux na Macu właściciela (Ubuntu 22.04 arm64, Node 22, Xvfb, bez roota) Electron nie wystartuje – brak GTK3 i `libXss`, ports.ubuntu.com zablokowane; alternatywa: Chromium bez GTK z npm (np. `@sparticuz/chromium`) + `puppeteer-core`, albo renderowanie w środowisku Claude na kopii plików.
29. **Rewersy zależne od karty** – **odłożone** (decyzja 10.10.2026). Plan: `[Kolumny]` i `jeśli=` w sekcji `[REWERS]` (rewers bez kolumn = wspólny jak dziś); podgląd z przełącznikiem rewersów, osobne pliki rewersów w eksporcie obrazków, w playingcards.io rewers dynamiczny (`cardTypes[…]['image-back']`), wykrywanie zmian także po rewersie. Druk A4: arkusz rewersów jako lustro arkusza awersów – drukarka właściciela odwraca kartkę **wzdłuż dłuższej krawędzi** (kolumny w odwrotnej kolejności). Sposób określania rewersu (kolumny w `[REWERS]` czy kolumna z obrazkiem) – do ustalenia.
34. **CMYK w PDF dla drukarni** (reszta pkt 33, „na razie się nie przejmujemy” – 10.10.2026): `printToPDF` daje tylko RGB; konwersja przez Ghostscript (AGPL – nie dołączamy; opcja, gdy zainstalowany z Homebrew).
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
  - 14. Historia wersji (od v0.4.8 kopie tylko w ważnych chwilach – patrz v0.4.8): `app/historia.js` (zapis tylko przy zmianie treści, przerzedzanie: godzina – 1/5 min, doba – 1/godz., miesiąc – 1/dzień, starsze – 1/tydz.; punkty: otwarcie (10 ostatnich), przed przywróceniem, nazwane – zostają zawsze). Renderer po `loadFromServer` (bez `tylkoNowe`) woła `historia:zapisz`. Panel `pokazHistorie`: różnice LCS (`roznice`, XLSX jako wiersze), `podgladWersji` (`PODGLAD_WERSJI` wstrzymuje odświeżanie), `przywrocWersje` (odmowa przy niezapisanym edytorze). `.historia/indeks.json` (`wersje[]`, `punkty[]`), kopie w `.historia/pliki/`. Obrazków nie kopiujemy.
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
- **v0.4.5** – kolejka: decyzje z 10.10.2026 (pkt 29–33). Odrzucone (nie proponować ponownie): eksport IDML, przepisanie na Rust, wersja webowa; `CLAUDE.md` dla prototypów w szablonie startowym (PR #18 zamknięty – właściciel chciał tylko pliku lokalnie).
- **v0.4.6** – druk i katalog (pkt 31, 32, 30, 33 + spad z pkt 4 w układzie Drukarnia):
  - 31. `LINIA = x1, y1, x2, y2` (grubość, kolor, styl ciągła/przerywana/kropkowana, początek/koniec: brak, strzałka, strzałka_pełna, kropka, kreska); `styl_obwódki` w `PROSTOKĄT`/`ELIPSA`.
  - 32. Linie cięcia nożyczkami w oknie Druk i PDF (znaczniki / przerywane linie / oba).
  - 30. Katalog talii A (menu) + B (zlecenie z pliku, `wynik.json`).
  - 33. Układ „Drukarnia”: strona na kopię, awers/rewers na przemian, spad (domyślnie 2 mm), bez znaczników; Raport: obrazki poniżej 300 dpi. CMYK odłożony (pkt 34).
  - Test (`--test-edytor`): linie cięcia, układ drukarnia (liczba i rozmiar stron, raport); poza przykładami katalog A i zlecenie B.
- **v0.4.7** – plan automatycznych aktualizacji w kolejce (pkt 1), przykład zlecenia katalogu w `docs/aplikacja.md` bez nazw talii właściciela.
- **v0.4.8** – historia wersji: kopie tylko w ważnych chwilach (decyzja 10.10.2026 – wcześniej przy każdym wczytaniu zmienionego pliku, za często). `zapiszHistorie()` po wczytaniu działa tylko przy otwarciu; `punktHistorii(etykieta)` (powód `eksport`) po PDF („PDF A4” / „PDF – drukarnia” / „PDF – osobne strony”), druku, eksporcie obrazków („eksport JPG 150 dpi”), playingcards.io i katalogu (A; zlecenia B – bez punktu); **siatka bezpieczeństwa** `siatkaHistorii()` co 5 min: powód `siatka`, etykieta „Siatka bezpieczeństwa”, `jesliZmiany` + `minOdstep` 1 h (opcje punktu w `historia.zapisz`, nie trafiają do indeksu); `historiaZamkniecie()` w main (`otworzSzablon`, `will-quit`; pliki z indeksu, `jesliZmiany`). Punkt bez nowych kopii z tym samym opisem co ostatni nie jest dublowany. Przerzedzanie punktów: otwarcie – 10, siatka – 24 ostatnie. ⌘S w edytorze – bez kopii. Testy: `test-historia.js` (siatka, odstęp, dedupe, limit 24), tryb testowy (`hist.bezKopii`, `hist.siatkaOdstep`, punkt `eksport`).
- **v0.4.9** – przykłady 04-karawana i 05-zaklecia (funkcje nieobecne w 01–03); katalog: JPG, rewers przed awersami; **poprawka czcionek w obrazkach kart** (`cssCzcionek`, wcześniej JPG/PNG/playingcards.io/katalog miały czcionkę zastępczą); test PNG 300 dpi liczy szerokość z najwęższej karty. Jednostronicowy PDF „wszystkie karty” – makieta pokazana właścicielowi, czeka na decyzję.
- **v0.4.10** – kolejka: pkt 35 (zlecenia z pliku dla całej gry: `pdf`, `obrazki`, `pcio`, `raport`, `stan`).
- **v0.4.11** – `app/scripts/testuj.sh` (testy przykładów równolegle) i „Jak pracować szybko” w tym pliku. 35. Zlecenia z pliku dla całej gry: `stan`, `raport`, `pdf`, `obrazki`, `pcio` (obok `katalog`), wynik `wynik-<polecenie>.json`, opis w `docs/aplikacja.md` („Zlecenia z pliku”). PDF ze zlecenia: nazwa domyślna jak przy ręcznym zapisie (nie `– karty.pdf`), żeby A4 i drukarnia się nie nadpisywały.
- **v0.4.12** – „Sposób pracy sesji” na początku tego pliku (wnioski z porównania sesji).
- **v0.5.0 „Gołąb pocztowy”** – 36. **Nowa nazwa: KarKa (Kawia Karciana)** (wcześniej rozważany „Talimat”): `productName`/menu/okna/DMG `KarKa.dmg`/`KarKa.zip`, `appId` bez zmian (`io.github.generatorkart` – decyzja właściciela), repozytorium `DarkenPL/KarKa` (zmianę nazwy robi właściciel; stare adresy przekierowują), `aktualizacje.przeniesDane` – przy pierwszym starcie ustawienia z `Application Support/Generator kart` (bez ostatnich projektów z przykładów starej `.app`); nazwę wprowadzono od razu w 0.5.0, bo 0.4.x i tak instaluje się ręcznie z DMG (bez wymuszania pełnej aktualizacji). Folder zleceń `.generator/` bez zmian. Ikona z kawią – do zrobienia (pomysł). 1. Automatyczne aktualizacje: mała (nakładka kodu ≈ 0,8 MB w Application Support, bez zmiany podpisu i pytań macOS) albo pełna (ZIP `.app` ≈ 120 MB, podmiana po zamknięciu) – przy starcie, z menu i zleceniem `aktualizacja`; rozrusznik `start.js` z ochroną przed zepsutą nakładką. Wersje 0.4.x – raz ręcznie z DMG. Repozytorium publiczne (historia sprawdzona przed upublicznieniem; dawne nazwy talii właściciela zostały tylko w historii commita 7322127). `testuj.sh` bierze ostatni wiersz JSON (ostrzeżenia X11 na wyjściu przy testach równoległych).

Kolejność i start każdego zadania ustala właściciel – nie zaczynać bez jego sygnału.
