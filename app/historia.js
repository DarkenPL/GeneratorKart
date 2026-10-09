'use strict';
// Historia wersji projektu: kopie szablonu i plików danych w ukrytym folderze `.historia/` projektu.
// - kopia powstaje tylko wtedy, gdy treść pliku różni się od jego ostatniej kopii,
// - punkty (otwarcie projektu, stan sprzed przywrócenia, punkty nazwane ręcznie) zapamiętują chwilę,
// - przerzedzanie: ostatnia godzina – 1 kopia / 5 min, doba – 1 / godz., 30 dni – 1 / dzień, starsze – 1 / tydzień.
//   Zawsze zostaje najnowsza kopia każdego pliku i kopie potrzebne do odtworzenia stanu z każdego punktu.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FOLDER = '.historia';
const MIN = 60 * 1000, GODZ = 60 * MIN, DZIEN = 24 * GODZ;
const MAKS_OTWARC = 10;            // tyle ostatnich punktów „otwarcie” zostaje
const SKRZYNKA = 'przychodzace';   // .historia/przychodzace/<nazwa>/: kopie plików + opis.txt od innych narzędzi

const skrot = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

function wczytajIndeks(projekt) {
  try {
    const i = JSON.parse(fs.readFileSync(path.join(projekt, FOLDER, 'indeks.json'), 'utf8'));
    return { wersje: i.wersje || [], punkty: i.punkty || [] };
  } catch (e) { return { wersje: [], punkty: [] }; }
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
  // Punkty „otwarcie”: tylko kilka ostatnich; reszta punktów (ręczne, przed przywróceniem) zostaje zawsze.
  const otwarcia = punkty.filter((p) => p.powod === 'otwarcie').sort((a, b) => b.czas - a.czas);
  const zbedne = new Set(otwarcia.slice(MAKS_OTWARC));
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
function zBlokada(projekt, fn) {
  fs.mkdirSync(path.join(projekt, FOLDER), { recursive: true });
  const blok = path.join(projekt, FOLDER, 'indeks.lock');
  for (let i = 0; ; i++) {
    try { fs.closeSync(fs.openSync(blok, 'wx')); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(blok).mtimeMs > 10000) { fs.unlinkSync(blok); continue; } } catch (e2) { continue; }
      if (i > 100) throw new Error('Historia jest zajęta (plik .historia/indeks.lock)');
      spij(50);
    }
  }
  try { return fn(); } finally { try { fs.unlinkSync(blok); } catch (e) {} }
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
// (ścieżki jak w projekcie, np. Szablony/gra.txt, karty.csv). Po imporcie podfolder jest usuwany.
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
    fs.rmSync(dir, { recursive: true, force: true });
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
  const zostaja = new Set(po.wersje.map((v) => v.id));
  for (const v of indeks.wersje) if (!zostaja.has(v.id)) {
    try { fs.unlinkSync(path.join(projekt, FOLDER, 'pliki', v.id)); } catch (e) {}
  }
  zapiszIndeks(projekt, po);
}

// Kopiuje pliki, które zmieniły się od ostatniej kopii. `punkt`: { powod, etykieta } – dodatkowo zapamiętuje chwilę.
function zapisz(projekt, pliki, punkt = null, teraz = Date.now()) {
  return zBlokada(projekt, () => zapiszBezBlokady(projekt, pliki, punkt, teraz));
}
function zapiszBezBlokady(projekt, pliki, punkt, teraz) {
  const indeks = wczytajIndeks(projekt);
  const zeSkrzynki = importujSkrzynke(projekt, indeks);
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
  if (punkt) indeks.punkty.push({ czas: teraz, powod: punkt.powod || 'punkt', etykieta: String(punkt.etykieta || '').slice(0, 200) });
  if (!nowe && !punkt && !zeSkrzynki) return 0;
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

module.exports = { FOLDER, SKRZYNKA, wczytajIndeks, zapisz, przerzedz, tresc, stan, przywroc, kopiaZChwili, sprawdzSkrzynke };
