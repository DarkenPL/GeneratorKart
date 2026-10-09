# Prototyp gry – kontekst dla Claude

Ten folder to prototyp gry planszowej lub karcianej, robiony w aplikacji **Generator kart** (Mac). Claude pomaga projektować grę (zasady, karty, balans) i przygotowuje pliki, z których aplikacja rysuje karty. Aplikacja: https://github.com/DarkenPL/GeneratorKart (prywatne repozytorium właściciela; pełny opis komend w `docs/komendy.md`, obsługa w `docs/aplikacja.md`).

## Zasady współpracy

- Rozmawiamy **po polsku**. Pliki gry, karty, zasady i komentarze też po polsku (chyba że gra ma inny język).
- **Dane gry są prywatne.** Nie trafiają do repozytorium Generatora kart ani nigdzie publicznie. W repozytorium generatora są tylko zmyślone przykłady.
- **Decyzje projektowe należą do właściciela.** Proponuj (2–3 warianty z plusami i minusami), nie wdrażaj dużych zmian w zasadach ani kartach bez zgody. Drobne poprawki (literówki, za długi tekst) – można od razu, z informacją.
- Zanim zmienisz pliki gry, zapisz punkt w historii („Claude: przed …”), po zmianie – drugi („Claude: po …”). Patrz „Historia wersji”.
- Po każdej zmianie sprawdź wynik (patrz „Sprawdzanie”) i podsumuj krótko: co zmienione, ile kart, czy są uwagi.
- Nowe ikony i grafiki: tylko własne albo na wolnej licencji (np. game-icons.net, CC BY 3.0 – zapisz autora w `CZYTAJ.txt`).

## Struktura projektu

```
Szablony/gra.txt   wygląd kart (szablon) – ten plik otwiera się w aplikacji
karty.csv          dane kart: jeden wiersz = jedna karta (kolejne talie: osobne pliki CSV albo arkusze XLSX)
ikony.csv          opcjonalnie: znaczniki ikon z emoji zastępczym; zwykle wystarczy folder Ikony/
Ikony/             ikony do tekstu: plik Ikony/moneta.svg = znacznik {moneta}
Art/               ilustracje kart
Export/            obrazki kart z eksportu (generuje aplikacja – nie edytować)
.historia/         historia wersji (prowadzi aplikacja – nie edytować ręcznie)
zasady.md          zasady gry (proponowany plik – trzymaj go aktualnym)
playtesty.md       notatki z playtestów (proponowany plik)
```

Folder projektu to folder szablonu albo – gdy szablon leży w `Szablony/` – folder nad nim. Ścieżki w szablonie liczą się od folderu projektu.

## Dane kart (CSV)

- Pierwszy wiersz = nazwy kolumn. Separator `;`, kodowanie UTF-8. Nowa linia w komórce = nowa linia na karcie.
- Kolumny specjalne (pisownia dowolna): **`ID`** (stały identyfikator karty – nie zmieniaj go między wersjami, od niego zależą nazwy plików i „zmienione karty”), **`Ilość`** (liczba kopii; `0` pomija kartę), **`Nazwa`**.
- W treści: `**pogrubienie**`, `*kursywa*`, `{ikona}`. Ścieżki obrazków np. `Art/lis.png`.
- Kolumny nazywaj krótko i bez spacji, jeśli się da (`Koszt`, `Efekt`, `Typ`, `Kolor`).

## Szablon – ściąga

Wymiary w mm, (0, 0) = lewy górny róg karty. `;` zaczyna komentarz.

```
PROJEKT = Nazwa gry              ; w nazwach plików
WERSJA  = v0.1                   ; podbijaj przed każdym playtestem; na karcie: [_wersja]
KARTA   = 63, 88, zaokrąglenie=3 ; 63×88 = karta pokerowa
KOLOR   = ogień, #C0504D         ; paleta: nazwy kolorów do użycia w danych i szablonie
STAŁA   = m, 3.5                 ; [=m] w dowolnej komendzie
CZCIONKA = "EB Garamond, Georgia, serif", 10, kolor=#222

[TALIA Akcje]
DANE  = akcje.csv                ; albo gra.xlsx#Akcje (arkusz)
TŁO   = [Kolor] | #cccccc        ; | = wartość zapasowa; gradient: #fff > [Kolor], kierunek=90
PROSTOKĄT = 3, 3, 57, 82, kolor=#ffffff, zaokrąglenie=3, obwódka=0.5, kolor_obwódki=#000, krycie=0.8
ELIPSA    = x, y, szer, wys, kolor=…
OBRAZEK   = 6, 14, 51, 34, [Obrazek], dopasuj=zmieść|wypełnij|rozciągnij, pion=dół
IKONA     = 50, 4, 8, 8, {gwiazda}
TEKST     = 6, 5, 51, 8, [Koszt], ikony=1.8, jedna_linia, grupa=góra, min=0.4
TEKST     = 6, 50, 51, 22, "**Efekt:** [Efekt]", rozmiar=9, wyrównanie=środek, pion=środek
TEKST     = 6, 82.3, 51, 2.2, "[_wersja] · [_numer]/[_liczba]", rozmiar=5, kolor=#999, wyrównanie=prawo

[REWERS]
TŁO   = #3d3a36
TEKST = 0, 0, 63, 88, "Nazwa gry", rozmiar=24, kolor=#fff, wyrównanie=środek, pion=środek
```

- Opcje `TEKST`: `czcionka=`, `rozmiar=` (pt), `kolor=`, `wyrównanie=lewo|środek|prawo|wyjustuj`, `pion=góra|środek|dół`, `interlinia=`, `ikony=` (wielkość ikon), `min=` (najmniejsza skala przy zmniejszaniu), `grupa=` (pola zmniejszają się razem w całej talii), `obrys=0.3, kolor_obrysu=`, `cień` / `cień=kolor`; flagi: `pogrubienie`, `kursywa`, `podkreślenie`, `wersaliki`, `jedna_linia`.
- Każdy element: `obrót=90`, `jeśli=[Kolumna]` (niepusta), `jeśli=[Typ]=burza`, `jeśli=[Typ]!=burza`.
- Element znika, gdy wszystkie `[Kolumny]` w jego treści są puste.
- Za długi tekst zmniejsza się sam; jeśli nadal się nie mieści – czerwona ramka i uwaga.
- Pola wbudowane: `[_numer]`, `[_liczba]`, `[_kopia]`, `[_id]`, `[_wersja]`, `[_talia]`, `[_projekt]`, `[_data]`.
- Sekcje: `[TALIA Nazwa]`, `[REWERS]`, `[AWERS]`. Wszystko przed pierwszą `[TALIA]` jest wspólne.
- Czcionki: `CZCIONKA = "krój, zapasowy", rozmiar, kolor=` (domyślna dla kolejnych tekstów), `CZCIONKA_PLIK = "Nazwa", Fonts/plik.ttf`, `CZCIONKA_GOOGLE = Lobster` (wymaga internetu).
- Komend `PCIO` i `STÓŁ` już się nie używa (dają tylko uwagę).

Przed użyciem rzadszej komendy sprawdź `docs/komendy.md` w repozytorium – może być nowsza wersja aplikacji niż ta ściąga.

## Jak Claude pracuje z plikami

- **Pliki gry** są na Macu właściciela; Claude ma do nich dostęp, gdy folder gry jest podłączony do rozmowy (połączenie z komputerem w aplikacji Claude). Powłoka po stronie Maca to Linux (Ubuntu, Node 22) z dostępem tylko do podłączonych folderów – edytuj tam pliki na miejscu, nie odtwarzaj ich z pamięci.
- **Aplikacji na Macu Claude nie uruchomi** (ani Electrona w powłoce na Macu – brak GTK). Do sprawdzania kart: skopiuj szablon, CSV, ikony i obrazki do swojego środowiska i uruchom tam silnik w trybie testowym (niżej).
- **Właściciel ma aplikację otwartą** – po zapisie plików karty odświeżają się u niego same (co 1,5 s).

### Sprawdzanie (środowisko Claude)

```
git clone https://github.com/DarkenPL/GeneratorKart && cd GeneratorKart/app
npm ci && npm run zasoby
xvfb-run -a ./node_modules/.bin/electron --no-sandbox --user-data-dir=/tmp/ud . \
  --test-pdf /tmp/kopia-gry/Szablony/gra.txt /tmp/wynik.pdf
```

- Zawsze na **kopii** projektu (tryb testowy zapisuje `Export/`).
- Wynik: JSON z `stan` (liczba kart), `uwagi` (powinno być pusto) i `ok`; obok PDF i zrzut ekranu `/tmp/wynik.png`. Obejrzyj PDF (`pdftoppm -r 60 -png`) – zwłaszcza karty z najdłuższym tekstem.
- Cel: **zero Uwag**, brak czerwonych ramek, tekst czytelny (nie mniejszy niż ok. 6 pt na awersie).

### Historia wersji

Aplikacja sama zapisuje kopie szablonu i CSV w `.historia/`. Claude oznacza swoje zmiany punktami:

```
# skrypt z repozytorium: app/historia.js + app/historia-cli.js (skopiuj oba do katalogu tymczasowego)
node historia-cli.js punkt ~/mnt/<folder gry> "Claude: przed przerobieniem efektów"
… zmiany …
node historia-cli.js punkt ~/mnt/<folder gry> "Claude: po przerobieniu efektów"
node historia-cli.js lista ~/mnt/<folder gry>
```

Właściciel widzi punkty w panelu Historia (różnice, podgląd kart, przywracanie). Bez Node: skrzynka `.historia/przychodzace/<2026-10-09T12-30-00>/` z kopiami plików i `opis.txt`.

## Proces prototypu

1. **Koncepcja** – w 2–3 zdaniach: temat, liczba graczy, czas gry, główna decyzja gracza, jak się wygrywa. Zapisz na górze `zasady.md`.
2. **Zasady v0.1** – tura, zasoby, karty i ich rola, koniec gry. Krótko; pytaj o niejasności.
3. **Lista komponentów** – talie (ile kart, jakie typy), żetony, plansza. Na tej podstawie kolumny CSV.
4. **Dane kart** – CSV z `ID`, `Ilość`, `Nazwa` i kolumnami mechaniki. Najpierw mechanika, potem klimat (nazwy, cytaty).
5. **Szablon v0.1** – czytelny, prosty: nazwa, koszt, efekt, typ kolorem; stopka z wersją i numerem. Ładne grafiki później.
6. **Pierwszy wydruk** – Plik → Drukuj / Zapisz PDF: A4 ze znacznikami cięcia, często **Szkic** (oszczędza tusz). Gra zdalna: Plik → Eksport → Pokój playingcards.io (każda talia jako stos).
7. **Playtest** – notatki w `playtesty.md` (data, wersja, gracze, co działało, co nie, pomysły).
8. **Iteracja** – zmiany w CSV i szablonie, `WERSJA` podbita, punkt w historii „przed playtestem N”. Do druku: tylko zmienione karty (okno druku → „Tylko zmienione od ostatniego PDF”).
9. **Balans** – Raport projektu (powtórzone ID, puste pola, nieużywane kolumny); tabelki kosztów/efektów liczy Claude z CSV.

## Dobre praktyki

- Stałe `ID` kart; nowe karty = nowe ID, nie przenumerowuj.
- Krótkie efekty: jedna myśl na kartę; powtarzalne słowa kluczowe pogrubione i opisane w zasadach.
- Ikony zamiast słów dla zasobów i kosztów (`{drewno}{drewno}`), wiersz kosztu z `grupa=` – równe rozmiary na wszystkich kartach.
- Kolor typu karty z palety `KOLOR`, nie wpisany kodem w każdym wierszu.
- Powtarzane liczby w szablonie jako `STAŁA`.
- Stopka `[_wersja] · [_numer]/[_liczba]` do czasu wersji finalnej – od razu wiadomo, z której wersji jest karta.
- Format kart: 63×88 (pokerowe), 56×87 (USA), 59×92 (euro), 44×68 (mini), 88×63 (poziome).

## Ograniczenia aplikacji (stan: v0.4.4)

- Brak spadu do druku i korekty przesunięcia rewersów (zaplanowane) – do drukarni na razie PDF 1:1 bez spadu albo PNG 300 dpi.
- Brak eksportu do Tabletop Simulator, statystyk talii i katalogu kart (w kolejce).
- Tylko Mac z procesorem Apple.
