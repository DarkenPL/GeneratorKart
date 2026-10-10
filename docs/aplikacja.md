# Aplikacja Generator kart

## Pobieranie

**[Pobierz najnowszą wersję](https://github.com/DarkenPL/GeneratorKart/releases/latest/download/Generator-kart.dmg)** (`Generator-kart.dmg`).

Aplikacja działa na Macach z procesorem Apple (M1–M4). Jaki masz procesor, sprawdzisz w  → **Ten Mac** (pozycja „Układ”).

Plik budowany jest automatycznie po każdej zmianie w gałęzi `main`, a każda wersja dostaje własne wydanie (`v0.4.3`, `v0.4.4`…) w zakładce **Releases** – starsze wersje zostają do pobrania. Wersja robocza z pull requestu jest w zakładce **Actions** → uruchomienie „Aplikacja macOS” → **Artifacts**.

## Instalacja i pierwsze uruchomienie

1. Otwórz pobrany plik `Generator-kart.dmg` i w okienku przeciągnij **Generator kart** na folder **Programy**. Potem możesz go wysunąć (w Finderze ⏏) i skasować.
2. Aplikacja nie jest podpisana certyfikatem Apple (wymaga płatnego konta deweloperskiego), więc przy pierwszym uruchomieniu macOS ją zablokuje. Odblokowujesz ją raz:
   - kliknij aplikację **prawym przyciskiem → Otwórz → Otwórz**,
   - albo, jeśli macOS pokaże tylko „Gotowe/Przenieś do Kosza”: otwórz **Ustawienia systemowe → Prywatność i ochrona**, przewiń w dół i kliknij **Otwórz mimo to** przy „Generator kart”.

   Gdyby macOS twierdził, że aplikacja jest „uszkodzona”, wpisz w Terminalu:

   ```
   xattr -dr com.apple.quarantine "/Applications/Generator kart.app"
   ```

## Praca

1. **Plik → Nowy projekt… (⌘N)** tworzy folder gry o podanej nazwie, z gotowym szablonem (`Szablony/gra.txt`), plikiem kart (`karty.csv`), ikonami, przykładowym obrazkiem i krótką instrukcją (`CZYTAJ.txt`), i od razu go otwiera. Wystarczy zmieniać pliki.

   **Plik → Otwórz szablon… (⌘O)** otwiera istniejący projekt: wskaż plik szablonu (`.txt`) swojej gry.
   - Szablon wskazuje resztę plików: dane kart (`DANE = …`), obrazki, czcionki.
   - Ścieżki liczą się od folderu projektu: tego, w którym leży szablon, albo folderu nad `Szablony`, gdy szablon leży w takim podfolderze.
   - Szablon możesz też otworzyć z Findera: prawy przycisk → **Otwórz za pomocą → Generator kart**.
2. Karty odświeżają się same po każdym zapisie szablonu, pliku z kartami albo obrazka.
3. **Edytor szablonu** (przycisk **Edytor** albo ⌥⌘E) otwiera szablon w panelu obok kart:
   - kolorowanie składni: komendy, `[Kolumny]`, `{ikony}`, opcje, liczby, kolory (podkreślone swoim kolorem), komentarze;
   - podgląd na żywo: karty zmieniają się w trakcie pisania, jeszcze przed zapisem;
   - błędy: wiersz z błędem jest podświetlony, a lista pod edytorem i Uwagi nad kartami prowadzą kliknięciem do właściwego wiersza;
   - **⌘S** zapisuje szablon, a ⌘Z cofa zmiany;
   - aplikacja pyta o zapis niezapisanych zmian przy zamykaniu okna, wyjściu i otwieraniu innego projektu. Kropka w czerwonym przycisku okna oznacza niezapisane zmiany;
   - gdy plik zmieni się na dysku, np. w innym edytorze, a w panelu są niezapisane zmiany, aplikacja pyta, którą wersję zostawić;
   - przykłady są w edytorze tylko do odczytu.

   Szablon nadal możesz edytować w dowolnym innym edytorze tekstu.
4. **Pasek** nad kartami: **Edytor**, **Historia**, **Raport**, wybór talii w podglądzie i **Eksport obrazków…**. Pod nim wiersz stanu: liczba kart, karty zmienione od ostatniego PDF i zaznaczone karty. Pozostałe polecenia są w menu **Plik** (druk, PDF, eksport do playingcards.io) i **Widok** (odświeżanie, raport).
5. **Okna druku i eksportu.** Eksport obrazków (⌘E), druk (⌘P), zapis PDF (⇧⌘S) i pokój playingcards.io otwierają okno z opcjami. Okno **pamięta ostatnie ustawienia osobno dla każdego projektu**. Enter zatwierdza, Esc anuluje.
   - **Obrazki:** rozdzielczość 150 dpi (ekran, playtesty online) albo 300 dpi (druk, drukarnie), format JPG albo PNG (przezroczyste zaokrąglone rogi), które karty, talie, rewersy jako osobne pliki.
   - **Druk i PDF:** układ, linie cięcia, spad, rewersy, **szkic** (bez teł i obrazków, czarny tekst – oszczędza tusz), które karty, talie; przyciski **Drukuj…** i **Zapisz PDF**.
     - Układy: **A4** (karty 1:1 w siatce, po każdym arkuszu arkusz rewersów), **każda karta na osobnej stronie** i **Drukarnia**.
     - **Linie cięcia** (układ A4): znaczniki na marginesie (gilotyna, nóż), przerywane szare linie wzdłuż krawędzi każdej karty (nożyczki) albo jedno i drugie. Arkusz rewersów nie ma linii.
     - **Drukarnia** (PDF dla drukarni, np. Printnet): jedna strona na kopię karty, kolejno awers, rewers, awers, rewers…; strona większa od karty o **spad** z każdej strony (domyślnie 2 mm – karta 63×88 mm daje stronę 67×92 mm); bez znaczników cięcia i bez zaokrąglonych rogów (rogi wycina drukarnia). Tło karty sięga do krawędzi strony; prostokąty i obrazki (`dopasuj=wypełnij` albo `rozciągnij`) dotykające krawędzi karty są przedłużone o spad. Teksty, ikony, linie i obwódka karty zostają na miejscu, więc trzymaj je min. 3 mm od krawędzi. PDF jest w RGB – drukarnia przelicza go do CMYK.
     - Drukarnie chcą obrazków min. **300 dpi** w rozmiarze na karcie – Raport pokazuje obrazki o mniejszej rozdzielczości.
   - **playingcards.io:** rozdzielczość i talie ([opis](playingcards.md)).
   - **Które karty:** wszystkie, tylko zaznaczone albo tylko zmienione od ostatniego PDF.
6. **Zaznaczanie i zmienione karty:**
   - Kliknij kartę w podglądzie, żeby ją zaznaczyć (niebieska ramka), Shift+klik zaznacza zakres. Liczbę zaznaczonych i przycisk **Wyczyść** widać w wierszu stanu. Zaznaczenie zostaje po odświeżeniu kart.
   - Po każdym zapisie PDF aplikacja zapamiętuje wygląd wydrukowanych kart. Karty zmienione od tamtej pory mają **pomarańczową** obwódkę, a nowe **zieloną**. **Porównaj** pokazuje każdą zmienioną kartę „przed” (z ostatniego PDF) i „teraz”.
   - Zmianą jest wszystko, co widać na karcie: tekst z danych, szablon, obrazek. Karty z częściowego wydruku są zapamiętywane pojedynczo, więc „zmienione” znaczy „zmienione od ostatniego wydruku tej karty”. Druk przez systemowe okno drukowania nie zapamiętuje kart, bo nie wiadomo, czy wydruk się udał.
7. **Historia wersji** (przycisk **Historia** albo **Plik → Historia wersji…**): aplikacja sama zapisuje kopię szablonu i plików z kartami (CSV, XLSX) przy każdej zmianie – z edytora i z innych programów – w ukrytym folderze `.historia` projektu.
   - Kopia powstaje tylko wtedy, gdy plik naprawdę się zmienił. Starsze kopie są przerzedzane: z ostatniej godziny zostaje jedna na 5 minut, z ostatniej doby jedna na godzinę, z miesiąca jedna na dzień, starsze jedna na tydzień.
   - Na zawsze zostają **punkty**: otwarcie projektu (10 ostatnich), stan sprzed przywrócenia i punkty nazwane przez Ciebie (pole „np. przed playtestem 3” → **Zapisz punkt**).
   - Przy każdej wersji: **Zmiany** (różnice linii względem obecnej wersji), **Pokaż karty** (podgląd kart z tamtej wersji; obrazki są obecne, bo nie są kopiowane) i **Przywróć…** (drugie kliknięcie potwierdza). Przed przywróceniem obecny stan trafia do historii, więc przywrócenie da się cofnąć.
   - Przykłady nie mają historii. Folder `.historia` możesz usunąć – historia zacznie się od nowa.
   - **Z innych programów** (np. gdy Claude zmienia pliki gry): punkt z opisem można dodać z konsoli – `node historia-cli.js punkt <folder projektu> "opis"` (także `lista` i `przywroc <nr>`; plik `app/historia-cli.js` z repozytorium, wymaga Node 18+) – albo przez **skrzynkę**: folder `.historia/przychodzace/<nazwa>/` z kopiami plików (ścieżki jak w projekcie, np. `Szablony/gra.txt`) i plikiem `opis.txt`. Aplikacja w ciągu kilku sekund zamienia go w punkt historii z tym opisem i usuwa folder. Nazwa folderu w formie `2026-10-09T12-30-00` ustala datę punktu.
8. **Raport** (przycisk w pasku albo **Widok → Raport projektu**) sprawdza projekt: powtórzone ID, puste pola w kolumnach używanych w szablonie, kolumny, których szablon nie używa, karty pominięte (`Ilość = 0`), obrazki poniżej 300 dpi w rozmiarze na karcie (pliki SVG są pomijane), ikony bez użycia i obrazki w folderach projektu, do których nic się nie odwołuje. Raport odświeża się razem z kartami.
9. Aplikacja pamięta ostatnie szablony (**Plik → Ostatnie projekty**) i przy starcie otwiera ostatni.

| Skrót | Działanie |
|---|---|
| ⌘N | Nowy projekt |
| ⌘O | Otwórz szablon |
| ⌘S | Zapisz szablon (z edytora) |
| ⌘E | Eksport obrazków (okno opcji) |
| ⌘P | Drukuj (okno opcji, potem systemowe okno drukowania) |
| ⇧⌘S | Zapisz PDF (okno opcji) |
| ⌥⌘E | Pokaż/ukryj edytor szablonu |
| ⌘R | Odśwież karty (automatyczne odświeżanie: **Widok → Odświeżaj automatycznie**) |

- **Eksport obrazków** zapisuje każdą kartę (i rewersy) jako osobny plik JPG albo PNG w folderze `Export` obok szablonu albo folderu `Szablony`.
  - Nazwy: `NazwaProjektu_NazwaTalii_NumerKarty_NumerKopii.jpg` (albo `.png`), np. `ZlotaWyprawa_Przedmioty_7_2.jpg`; rewers: `ZlotaWyprawa_Przedmioty_rewers.jpg`.
  - Nazwa projektu pochodzi z komendy `PROJEKT = …` w szablonie, a bez niej z nazwy pliku szablonu. Numer karty to kolumna `ID` (gdy jej brak – numer wiersza), a numer kopii liczy się od 1 według kolumny `Ilość`.
  - Polskie znaki i spacje są pomijane (`Karty Wpływu` → `KartyWplywu`).
  - Pliki o tych samych nazwach są nadpisywane, inne pliki w `Export` zostają.
- **Eksport do playingcards.io** zapisuje nowy pokój (`NazwaProjektu – playingcards.pcio`) w folderze projektu – każda talia jako osobny stos ([opis](playingcards.md)).
- **Katalog talii** (**Plik → Eksport → Katalog talii (PNG)…**): dla każdej talii obrazek PNG z siatką zmniejszonych kart i podpisami (ID, nazwa, liczba kopii) – do przeglądu całej talii, instrukcji i dla testerów. Pliki `NazwaProjektu_NazwaTalii.png` w `Export/katalog`; obrazek ma najwyżej ok. 2000×2000 px, więc duże talie dzielą się na kilka plików (`_1`, `_2`…). Karty z za długim tekstem mają czerwoną ramkę.
  - **Zlecenie z pliku** (np. od Claude, bez klikania): plik `.generator/zlecenia/katalog` w folderze projektu. Może być pusty albo zawierać wiersze `talie = Rośliny, Pogoda` i `id = 1, 7`. Otwarta aplikacja w ciągu kilku sekund robi katalog do `.generator/katalog/`, usuwa plik zlecenia i zapisuje `.generator/zlecenia/wynik.json` (pliki, talie, Uwagi, karty za długie, czy edytor ma niezapisane zmiany). Działa tylko poza przykładami.
- **Przykłady** są tylko do odczytu. Eksport obrazków pyta wtedy o folder. Żeby zmieniać przykład, skopiuj jego folder z repozytorium i otwórz szablon kopii.

## Dla deweloperów

```
cd app
npm ci
npm start          # zasoby + uruchomienie
npm run dist       # budowanie .app (na macOS)
```

- `app/generator/karty.html`: interfejs i cały silnik generatora (jeden plik HTML).
- `app/main.js`: okno, menu, ostatnie projekty, zapis PDF, eksport do `Export/`, podmiana adresów CDN na zasoby lokalne.
- `app/serwer.js`: lokalny serwer HTTP, który podaje pliki projektu.
- `app/scripts/zasoby.js`: kopiuje generator, przykłady, biblioteki i czcionki do `app/zasoby/`.
- Tryb testowy: `Generator kart [--test-nowy <nowy folder>] [--test-edytor] --test-pdf <szablon.txt|folder|-> <wynik.pdf>` otwiera projekt, sprawdza eksport JPG (poza przykładami także do `Export/`), zapisuje PDF i zrzut ekranu, a potem kończy z kodem 0 albo 1. `-` oznacza ekran powitalny.
- `.github/workflows/aplikacja-mac.yml`: budowanie i testy na macOS. Po każdej zmianie w `main` tworzy wydanie `v<wersja>` z DMG (wersja z `app/package.json`).

### Wydania

Każda zmiana w `main` podnosi wersję w `app/package.json` (0.4.3 → 0.4.4 …). Po scaleniu workflow sam tworzy wydanie `v<wersja>` z plikiem DMG, opisem (lista scalonych PR-ów) i oznaczeniem „najnowsze”, więc link do pobrania w README wskazuje ostatnią wersję. Gdy wersja nie została podniesiona, wydanie nie powstaje (ostrzeżenie w Actions).

Ręcznie opublikowane wydanie albo wypchnięty tag `v*` też dostaną DMG – workflow dołączy plik po kilku minutach.
