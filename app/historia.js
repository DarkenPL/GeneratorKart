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

// Kopiuje pliki, które zmieniły się od ostatniej kopii. `punkt`: { powod, etykieta } – dodatkowo zapamiętuje chwilę.
function zapisz(projekt, pliki, punkt = null, teraz = Date.now()) {
  const indeks = wczytajIndeks(projekt);
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
  if (!nowe && !punkt) return 0;
  const po = przerzedz(indeks, teraz);
  const zostaja = new Set(po.wersje.map((v) => v.id));
  for (const v of indeks.wersje) if (!zostaja.has(v.id)) {
    try { fs.unlinkSync(path.join(projekt, FOLDER, 'pliki', v.id)); } catch (e) {}
  }
  zapiszIndeks(projekt, po);
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
  const { wersje } = wczytajIndeks(projekt);
  const pliki = [...new Set(wersje.map((v) => v.plik))];
  zapisz(projekt, pliki, { powod: 'przed przywróceniem' }, teraz);
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

module.exports = { FOLDER, wczytajIndeks, zapisz, przerzedz, tresc, stan, przywroc, kopiaZChwili };
