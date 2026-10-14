'use strict';
// Historia wersji projektu: kopie szablonu i plików danych w ukrytym folderze `.historia/` projektu.
// - kopia powstaje tylko wtedy, gdy treść pliku różni się od jego ostatniej kopii,
// - kopie robi aplikacja w ważnych chwilach: otwarcie, eksport/druk/PDF, zamknięcie, siatka bezpieczeństwa
//   (najwyżej co godzinę, gdy coś się zmieniło), punkty nazwane, punkty od innych narzędzi (skrzynka, konsola),
// - punkty zapamiętują chwilę i jej opis,
// - przerzedzanie: ostatnia godzina – 1 kopia / 5 min, doba – 1 / godz., 30 dni – 1 / dzień, starsze – 1 / tydzień.
//   Zawsze zostaje najnowsza kopia każdego pliku i kopie potrzebne do odtworzenia stanu z każdego punktu.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FOLDER = '.historia';
const MIN = 60 * 1000, GODZ = 60 * MIN, DZIEN = 24 * GODZ;
const MAKS_OTWARC = 10;            // tyle ostatnich punktów „otwarcie” zostaje
const MAKS_SIATKA = 24;            // i tyle ostatnich punktów siatki bezpieczeństwa
const SKRZYNKA = 'przychodzace';   // .historia/przychodzace/<nazwa>/: kopie plików + opis.txt od innych narzędzi
const ZAIMPORTOWANE = 'zaimportowane'; // tu trafia folder skrzynki po imporcie, gdy nie wolno go usunąć

const skrot = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

function wczytajIndeks(projekt) {
  try {
    const i = JSON.parse(fs.readFileSync(path.join(projekt, FOLDER, 'indeks.json'), 'utf8'));
    return { wersje: i.wersje || [], punkty: i.punkty || [] };
  } catch (e) {
    const pusty = { wersje: [], punkty: [] };
    // Indeks istnieje, ale nie da się go odczytać: nie sprzątaj kopii „spoza indeksu” (byłyby to wszystkie).
    if (e.code !== 'ENOENT') Object.defineProperty(pusty, 'uszkodzony', { value: true });
    return pusty;
  }
}
function zapiszIndeks(projekt, indeks) {
  fs.mkdirSync(path.join(projekt, FOLDER, 'pliki'), { recursive: true });
  const p = path.join(projekt, FOLDER, 'indeks.json');
  fs.writeFileSync(p + '.tmp', JSON.stringify(indeks, null, 1));
  fs.renameSync(p + '.tmp', p);
}

// Ostatnia kopia pliku nie późniejsza niż chwila `czas` (stan pliku w tej chwili).
function kopiaZChwili(wersje, plik, czas) {
  let w = null;
  for (const v of wersje) if (v.plik === plik && v.czas <= czas && (!w || v.czas > w.czas)) w = v;
  return w;
}

// Które kopie i punkty zostają po przerzedzeniu (funkcja czysta – testowana w scripts/test-historia.js).
function przerzedz({ wersje, punkty }, teraz = Date.now()) {
  // Punkty „otwarcie” i „siatka”: tylko kilka ostatnich; reszta punktów (eksporty, ręczne, przed przywróceniem) zostaje zawsze.
  const ostatnie = (powod, n) => punkty.filter((p) => p.powod === powod).sort((a, b) => b.czas - a.czas).slice(n);
  const zbedne = new Set([...ostatnie('otwarcie', MAKS_OTWARC), ...ostatnie('siatka', MAKS_SIATKA)]);
  const punktyPo = punkty.filter((p) => !zbedne.has(p));
  const zostaja = new Set();
  const pliki = [...new Set(wersje.map((v) => v.plik))];
  for (const plik of pliki) {
    const kopie = wersje.filter((v) => v.plik === plik).sort((a, b) => b.czas - a.czas);
    zostaja.add(kopie[0]);                                             // najnowsza
    for (const p of punktyPo) { const k = kopiaZChwili(kopie, plik, p.czas); if (k) zostaja.add(k); }
    const kubly = new Set();
    for (const k of kopie) {                                           // od najnowszej: pierwsza w kuble zostaje
      const wiek = teraz - k.czas;
      const kubel = wiek < GODZ ? 'm' + Math.floor(k.czas / (5 * MIN))
        : wiek < DZIEN ? 'g' + Math.floor(k.czas / GODZ)
        : wiek < 30 * DZIEN ? 'd' + Math.floor(k.czas / DZIEN)
        : 't' + Math.floor(k.czas / (7 * DZIEN));
      if (!kubly.has(kubel)) { kubly.add(kubel); zostaja.add(k); }
    }
  }
  return { wersje: wersje.filter((v) => zostaja.has(v)), punkty: punktyPo };
}

// Blokada indeksu: aplikacja i polecenia z konsoli (historia-cli.js) mogą pisać w tym samym czasie.
const spij = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const bezPrawaUsuwania = (e) => e && (e.code === 'EPERM' || e.code === 'EACCES');
// Zdjęcie blokady: usunięcie, a gdy system nie pozwala usuwać (EPERM/EACCES – np. powłoka bez zgody na usuwanie) –
// przeniesienie na stałą nazwę `indeks.lock.wolna` (nadpisywaną; zostaje najwyżej jeden zbędny plik, sprząta go `posprzataj`).
function zdejmijBlokade(blok) {
  try { fs.unlinkSync(blok); } catch (e) {
    if (e.code === 'ENOENT') return;
    if (!bezPrawaUsuwania(e)) throw e;
    fs.renameSync(blok, blok + '.wolna');
  }
}
function zBlokada(projekt, fn) {
  fs.mkdirSync(path.join(projekt, FOLDER), { recursive: true });
  const blok = path.join(projekt, FOLDER, 'indeks.lock');
  for (let i = 0; ; i++) {
    try { fs.closeSync(fs.openSync(blok, 'wx')); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // Limit prób przed obsługą starej blokady: gdy nie da się jej zdjąć, nie kręcimy się bez końca.
      if (i > 100) throw new Error('Historia jest zajęta (plik .historia/indeks.lock)');
      try { if (Date.now() - fs.statSync(blok).mtimeMs > 10000) { zdejmijBlokade(blok); continue; } } catch (e2) { /* np. ENOENT – próbuj dalej */ }
      spij(50);
    }
  }
  try { return fn(); } finally { try { zdejmijBlokade(blok); } catch (e) {} }
}

// Pliki w folderze (rekurencyjnie), ścieżki względne z „/”.
function plikiFolderu(dir, pod = '') {
  const wynik = [];
  for (const d of fs.readdirSync(path.join(dir, pod), { withFileTypes: true })) {
    const rel = pod ? pod + '/' + d.name : d.name;
    if (d.isDirectory()) wynik.push(...plikiFolderu(dir, rel));
    else if (d.isFile()) wynik.push(rel);
  }
  return wynik;
}
// Czas z nazwy folderu skrzynki (2026-10-09T12-30-00 albo 2026-10-09 12.30), inaczej data pliku opis.txt / folderu.
function czasSkrzynki(dir, nazwa) {
  const m = /(\d{4})-(\d{2})-(\d{2})[T _](\d{2})[-:.](\d{2})(?:[-:.](\d{2}))?/.exec(nazwa);
  if (m) { const t = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime(); if (!Number.isNaN(t)) return t; }
  try { return fs.statSync(path.join(dir, 'opis.txt')).mtimeMs; } catch (e) { return fs.statSync(dir).mtimeMs; }
}
// Skrzynka: każdy podfolder .historia/przychodzace/ to punkt z opisem (opis.txt) i kopiami plików
// (ścieżki jak w projekcie, np. Szablony/gra.txt, karty.csv). Po imporcie podfolder jest usuwany
// (bez prawa usuwania – przenoszony do .historia/zaimportowane/).
function importujSkrzynke(projekt, indeks) {
  const skrzynka = path.join(projekt, FOLDER, SKRZYNKA);
  let nazwy = [];
  try { nazwy = fs.readdirSync(skrzynka, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch (e) { return 0; }
  let punkty = 0;
  for (const nazwa of nazwy) {
    const dir = path.join(skrzynka, nazwa);
    let czas = Math.round(czasSkrzynki(dir, nazwa));
    while (indeks.punkty.some((p) => p.czas === czas)) czas++;
    let opis = '';
    try { opis = fs.readFileSync(path.join(dir, 'opis.txt'), 'utf8').trim().split('\n')[0]; } catch (e) {}
    for (const plik of plikiFolderu(dir).filter((p) => p !== 'opis.txt')) {
      if (plik.split('/').some((x) => x === '..' || x.startsWith('.'))) continue;
      const dane = fs.readFileSync(path.join(dir, plik));
      const h = skrot(dane);
      const w = kopiaZChwili(indeks.wersje, plik, czas);
      if (w && w.hash === h) continue;
      const id = czas.toString(36) + '-' + crypto.randomBytes(3).toString('hex') + path.extname(plik).toLowerCase();
      fs.mkdirSync(path.join(projekt, FOLDER, 'pliki'), { recursive: true });
      fs.writeFileSync(path.join(projekt, FOLDER, 'pliki', id), dane);
      indeks.wersje.push({ id, plik, czas, hash: h, rozmiar: dane.length });
    }
    indeks.punkty.push({ czas, powod: 'punkt', etykieta: (opis || nazwa).slice(0, 200) });
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {
      if (!bezPrawaUsuwania(e)) throw e;
      // bez prawa usuwania: folder poza skrzynkę, żeby nie wrócił drugi raz (sprząta go później `posprzataj`)
      const kosz = path.join(projekt, FOLDER, ZAIMPORTOWANE);
      fs.mkdirSync(kosz, { recursive: true });
      fs.renameSync(dir, path.join(kosz, nazwa + '-' + crypto.randomBytes(3).toString('hex')));
    }
    punkty++;
  }
  return punkty;
}
// Sama skrzynka (aplikacja sprawdza ją co kilka sekund). Zwraca liczbę zaimportowanych punktów.
function sprawdzSkrzynke(projekt, teraz = Date.now()) {
  try { if (!fs.readdirSync(path.join(projekt, FOLDER, SKRZYNKA)).length) return 0; } catch (e) { return 0; }
  return zBlokada(projekt, () => {
    const indeks = wczytajIndeks(projekt);
    const n = importujSkrzynke(projekt, indeks);
    if (n) zapiszPrzerzedzony(projekt, indeks, teraz);
    return n;
  });
}
function zapiszPrzerzedzony(projekt, indeks, teraz) {
  const po = przerzedz(indeks, teraz);
  zapiszIndeks(projekt, po);
  posprzataj(projekt, po, indeks.uszkodzony);
}
// Sprzątanie przy każdym zapisie indeksu (pod blokadą): kopie spoza indeksu (przerzedzone – także te, których
// wcześniej nie dało się usunąć), `indeks.lock.wolna` i folder `zaimportowane/`. Błędy są pomijane – w powłoce
// bez prawa usuwania nic się nie dzieje, a aplikacja posprząta przy następnym zapisie.
function posprzataj(projekt, indeks, bezKopii = false) {
  const dir = path.join(projekt, FOLDER);
  const usun = (p, o) => { try { fs.rmSync(p, o); } catch (e) {} };
  if (!bezKopii) {
    const w = new Set(indeks.wersje.map((v) => v.id));
    let nazwy = [];
    try { nazwy = fs.readdirSync(path.join(dir, 'pliki')); } catch (e) {}
    for (const n of nazwy) if (!w.has(n)) usun(path.join(dir, 'pliki', n), { force: true });
  }
  usun(path.join(dir, 'indeks.lock.wolna'), { force: true });
  usun(path.join(dir, ZAIMPORTOWANE), { recursive: true, force: true });
}

// Kopiuje pliki, które zmieniły się od ostatniej kopii. `punkt`: { powod, etykieta } – dodatkowo zapamiętuje chwilę.
// Opcje punktu (nie są zapisywane):
//   jesliZmiany – punkt tylko wtedy, gdy powstała nowa kopia (siatka bezpieczeństwa, zamknięcie),
//   minOdstep   – ms; nic nie rób, jeśli ostatnia kopia jest młodsza (siatka: godzina).
// Punkt bez nowych kopii z tym samym opisem co poprzedni punkt (np. drugi PDF bez zmian) nie jest dublowany.
function zapisz(projekt, pliki, punkt = null, teraz = Date.now()) {
  return zBlokada(projekt, () => zapiszBezBlokady(projekt, pliki, punkt, teraz));
}
function zapiszBezBlokady(projekt, pliki, punkt, teraz) {
  const indeks = wczytajIndeks(projekt);
  const zeSkrzynki = importujSkrzynke(projekt, indeks);
  const { jesliZmiany, minOdstep, ...pk } = punkt || {};
  if (minOdstep && indeks.wersje.some((v) => v.czas > teraz - minOdstep)) {
    if (zeSkrzynki) zapiszPrzerzedzony(projekt, indeks, teraz);
    return 0;
  }
  let nowe = 0;
  for (const plik of [...new Set(pliki)]) {
    const pelna = path.join(projekt, plik);
    if (!pelna.startsWith(projekt + path.sep)) continue;
    let dane;
    try { dane = fs.readFileSync(pelna); } catch (e) { continue; }
    const h = skrot(dane);
    const ostatnia = kopiaZChwili(indeks.wersje, plik, Infinity);
    if (ostatnia && ostatnia.hash === h) continue;
    const id = teraz.toString(36) + '-' + crypto.randomBytes(3).toString('hex') + path.extname(plik).toLowerCase();
    fs.mkdirSync(path.join(projekt, FOLDER, 'pliki'), { recursive: true });
    fs.writeFileSync(path.join(projekt, FOLDER, 'pliki', id), dane);
    indeks.wersje.push({ id, plik, czas: teraz, hash: h, rozmiar: dane.length });
    nowe++;
  }
  let dodajPunkt = !!punkt && (nowe > 0 || !jesliZmiany);
  if (dodajPunkt && !nowe) {                       // bez zmian: nie powtarzaj tego samego punktu
    const ost = indeks.punkty.reduce((a, p) => (!a || p.czas > a.czas ? p : a), null);
    const ostKopia = Math.max(0, ...indeks.wersje.map((v) => v.czas));
    if (ost && ost.czas >= ostKopia && ost.powod === (pk.powod || 'punkt') && ost.etykieta === String(pk.etykieta || '').slice(0, 200)) dodajPunkt = false;
  }
  if (dodajPunkt) indeks.punkty.push({ czas: teraz, powod: pk.powod || 'punkt', etykieta: String(pk.etykieta || '').slice(0, 200) });
  if (!nowe && !dodajPunkt && !zeSkrzynki) return 0;
  zapiszPrzerzedzony(projekt, indeks, teraz);
  return nowe;
}

function tresc(projekt, id) {
  return fs.readFileSync(path.join(projekt, FOLDER, 'pliki', path.basename(String(id))));
}

// Stan wszystkich plików z historii w chwili `czas`: [{ plik, id, dane }].
function stan(projekt, czas) {
  const { wersje } = wczytajIndeks(projekt);
  return [...new Set(wersje.map((v) => v.plik))]
    .map((plik) => kopiaZChwili(wersje, plik, czas)).filter(Boolean)
    .map((v) => ({ plik: v.plik, id: v.id, dane: tresc(projekt, v.id) }));
}

// Przywraca stan z chwili `czas`. Najpierw zapisuje obecny stan jako punkt „przed przywróceniem”.
function przywroc(projekt, czas, teraz = Date.now()) {
  return zBlokada(projekt, () => przywrocBezBlokady(projekt, czas, teraz));
}
function przywrocBezBlokady(projekt, czas, teraz) {
  const { wersje } = wczytajIndeks(projekt);
  const pliki = [...new Set(wersje.map((v) => v.plik))];
  zapiszBezBlokady(projekt, pliki, { powod: 'przed przywróceniem' }, teraz);
  const zmienione = [];
  for (const { plik, dane } of stan(projekt, czas)) {
    const pelna = path.join(projekt, plik);
    let obecne = null;
    try { obecne = fs.readFileSync(pelna); } catch (e) {}
    if (obecne && obecne.equals(dane)) continue;
    fs.mkdirSync(path.dirname(pelna), { recursive: true });
    fs.writeFileSync(pelna, dane);
    zmienione.push(plik);
  }
  return zmienione;
}

module.exports = { FOLDER, SKRZYNKA, ZAIMPORTOWANE, wczytajIndeks, zapisz, przerzedz, tresc, stan, przywroc, kopiaZChwili, sprawdzSkrzynke };
