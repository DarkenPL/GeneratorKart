# Notatki projektu – Generator kart

Plik dla Claude (i ludzi): stan projektu, decyzje i lista pomysłów. Aktualizuj przy każdej większej zmianie.

## Zasady

- **Bez danych gier użytkownika w repozytorium.** Właściciel trzyma swoje projekty gier lokalnie i nie chce ich udostępniać. W repozytorium są tylko generator, dokumentacja i zmyślone przykłady.
- Język: polski (interfejs, komunikaty, komentarze w kodzie, dokumentacja).
- Generator ma pozostać **jednym plikiem HTML** bez kroku budowania.
- Nowe ikony do przykładów: tylko na wolnej licencji, z wpisem w `CREDITS.md` (game-icons.net = CC BY 3.0, podać autora i link do ikony).
- Zmiany wyglądu kart istniejących projektów muszą być zgodne wstecz. Przed zmianą silnika porównaj zrzuty kart przed/po (różnice tylko w wygładzaniu krawędzi).

## Struktura

```
karty.html                 cały generator (HTML + CSS + JS)
Uruchom generator.command  bash → wbudowany Perl macOS: serwer HTTP 127.0.0.1:8765
docs/                      dokumentacja użytkownika
przyklady/NN-nazwa/        przykładowe projekty (Szablony/, CSV, ikony.csv, Ikony/)
CREDITS.md                 autorzy ikon, licencje
```

## Architektura `karty.html`

Sekcje w kolejności w pliku:

1. **CSS**: wspólne zasady rysowania (`.karta`, `.el.tekst`, `.el.obrazek`, `.el.ikony`, `.ikona-kolor`), interfejs, `@media print`.
2. **CONFIG**: tylko ustawienia ogólne (folder szablonów, plik ikon, jakość JPG, rozmiar obrazków pcio). Nic, co dotyczy konkretnej gry. Paleta kolorów i plik pokoju pcio są w szablonach (`KOLOR`, `STÓŁ`).
3. **Wczytywanie plików**, w trzech trybach:
   - `showDirectoryPicker` (Chrome/Edge, z autoodświeżaniem po zmianie plików),
   - `<input webkitdirectory>` (zapas),
   - **tryb serwera**: strona otwarta przez `http(s)`. Pliki pobierane są `fetch`. Spis folderu `Szablony/` daje serwer (GET katalogu → JSON z nazwami). Zmiany wykrywa polling HEAD/Last-Modified co 1,5 s. `?folder=ścieżka` wskazuje projekt w podfolderze. Bez szablonów w katalogu głównym pokazuje się lista `przyklady/`. `/.wersja` odróżnia nowy serwer od starego.
4. **CSV/XLSX**: własny parser CSV (`;`/`,`, BOM, cudzysłowy); XLSX przez SheetJS z CDN.
5. **Ikony**: `ikony.csv` (Znacznik;Znak;Odstęp;Plik;Opis). `renderText()` zamienia `{znacznik}` na `<img>`. Gdy pliku brak, wstawia emoji ze Znak. `{kolor-X}`/`{kolor-X-mix}` (dawniej `{osiag-X}`) to prostokąt w kolorze z palety, rysowany CSS.
6. **Szablony**:
   - `parseTemplate(text, plik)` zwraca `{talie[], pliki, dane, czcionki, google, kolory, stol, bledy}`. Obsługuje sekcje `[TALIA X]`, `[REWERS]`, `[AWERS]`, część wspólną przed pierwszą `[TALIA]`, stan `CZCIONKA` oraz komentarze `;` i `#`.
   - `renderCard(tpl, cmds, row, ctx)` buduje HTML karty: elementy `.el` z pozycją absolutną w mm.
   - Wartości `[Kolumna]`: gwiazdki z danych są maskowane (`\u0001`), żeby nie włączały markdownu.
   - Element znika, gdy wszystkie pola w treści są puste.
   - `jeśli=` porównuje wartości bez względu na wielkość liter, a liczby liczbowo (001 = 1).
7. **Dopasowanie tekstu** (`fitAll`): pole zmniejsza się co 0,04 do `min`. Pola z `grupa=` skalują się razem: wspólna minimalna skala dla całej talii, krok 0,02, a kolizja to odstęp poniżej 2 mm. Pole, które się nie mieści, dostaje klasę `.za-dlugi` (czerwona ramka i uwaga).
8. **Druk** (`buildPrint`):
   - jeden format strony dla całego wydruku (A4 pionowo albo rozmiar karty), bo Safari nie obsługuje nazwanych `@page` i zmniejszał wydruk z mieszanymi formatami;
   - karty poziome są obracane o 90°. Przed obrotem karta musi wystawać w lewo, nie w prawo, inaczej Chrome zmniejsza cały wydruk;
   - siatka jest wyśrodkowana, znaczniki cięcia na marginesie, po każdym arkuszu pełny arkusz rewersów.
9. **Eksport JPG**: html-to-image `toCanvas`, potem rysowanie na białym tle (żeby zaokrąglone rogi nie wychodziły czarne) i `toBlob('image/jpeg')`. Uwaga: `toBlob` z html-to-image zawsze daje PNG, a opcja `backgroundColor` nadpisywała tło karty.
10. **Eksport playingcards.io** (`exportPcio`):
    - wczytuje `.pcio` (ZIP: `schemaVersion`, `widgets.json`, `userassets/`);
    - dla każdej talii z `PCIO = id` podmienia `cardTypes`, `faceTemplate` i `backTemplate`;
    - karty kładzie zakryte na stosie `deck.parent`, z przesunięciem wziętym z dawnej karty;
    - zachowuje tylko używane `userassets`.

## Testowanie (środowisko Claude)

- Chromium dla Playwright jest w `/opt/pw-browsers`.
- CDN (jsDelivr, Google Fonts) jest zablokowany. Biblioteki instaluj z npm (`html-to-image`, `jszip`) i podmieniaj przez `page.route('https://cdn.jsdelivr.net/**', …)`. Czcionki wypadają na zastępcze.
- Serwer testowy: `perl -x "Uruchom generator.command" 8766 <folder>`.
- Tryb plikowy: `page.set_input_files('#wybierzStary', folder)`.
- Druk: `buildPrint()`, potem `emulate_media('print')` i `page.pdf(prefer_css_page_size=True, print_background=True)`. Dokładność 1:1 sprawdzaj pomiarem znaczników cięcia na rastrze 300 dpi.
- Przed oddaniem zmiany przejrzyj wszystkie przykłady: zero Uwag i zero błędów strony.

## Pomysły / do zrobienia

1. **Nazwy plików JPG** (uzgodnione, czeka na wdrożenie): `NazwaProjektu_NazwaTalii_NumerKarty_NumerKopii.jpg`.
   - Nazwa projektu: nowa komenda `PROJEKT = …` w szablonie. Bez niej nazwa pliku szablonu, a w ostateczności `NowaGra`.
   - Numer karty to kolumna `ID` (gdy brak: numer wiersza). Kopie numerowane zawsze, od `_1`, według `Ilość`.
   - Rewers: `NazwaProjektu_NazwaTalii_rewers.jpg`. ZIP nazwany nazwą projektu.
   - Nazwy bez polskich znaków i spacji (`Złota Wyprawa` → `ZlotaWyprawa`).
2. **Aplikacja na Maca** (rekomendacja: Electron):
   - własna ikona, brak Terminala, ten sam silnik co testy;
   - przycisk „Zapisz PDF” przez `printToPDF` w dokładnym rozmiarze;
   - czcionki i biblioteki w środku, więc działa offline;
   - pamięta ostatnie projekty;
   - budowanie i podpisywanie przez GitHub Actions na macOS;
   - `karty.html` zostaje jako wersja przeglądarkowa ze wspólnym kodem.
3. Lista talii (`cardDeck`) z pliku `.pcio` w interfejsie, żeby nie trzeba było szukać `PCIO = id` w `widgets.json`.
4. Biblioteki (html-to-image, JSZip, SheetJS) i czcionki lokalnie zamiast z CDN, żeby generator działał offline.
5. Pola tekstowe z wysokością „auto” (rosnące z treścią do limitu).
