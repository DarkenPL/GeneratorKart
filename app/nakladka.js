'use strict';
// Wybór kodu przy starcie aplikacji (używa go start.js – część paczki, której aktualizacje nie zmieniają).
// Nakładka = nowszy kod aplikacji (main.js, karty.html, przykłady…) pobrany przez aktualizację do
// <dane aplikacji>/kod. Aplikacja w Programach zostaje nietknięta, więc podpis się nie zmienia
// i macOS nie pyta ponownie o dostęp do folderów. Nakładka działa tylko z tym samym Electronem,
// z którym została zbudowana, i tylko gdy jest nowsza niż kod w paczce.
//
// Ochrona przed zepsutą nakładką: przed startem zapisujemy znacznik start-<wersja>; aplikacja usuwa go,
// gdy okno się wczyta (potwierdzStart). Znacznik zastany przy następnym starcie = poprzedni start
// się nie udał → plik „zepsuta” z tą wersją i start z paczki.
const fs = require('fs');
const path = require('path');

function porownajWersje(a, b) {
  const x = String(a).split('.').map((n) => parseInt(n, 10) || 0), y = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length, 3); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}

const czytajJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// → { dir, wersja, znacznik } albo { dir: null, powod }
function wybierzNakladke(dir, { wbudowana, electron, zapisz = true }) {
  try {
    if (!fs.existsSync(path.join(dir, 'main.js'))) return { dir: null, powod: 'brak nakładki' };
    const wersja = czytajJson(path.join(dir, 'package.json')).version;
    const meta = czytajJson(path.join(dir, 'nakladka.json'));
    if (meta.wersja !== wersja) return { dir: null, powod: 'niepełna nakładka' };
    if (meta.electron !== electron) return { dir: null, powod: `nakładka dla Electrona ${meta.electron}, a jest ${electron}` };
    if (porownajWersje(wersja, wbudowana) <= 0) return { dir: null, powod: `nakładka ${wersja} nie jest nowsza niż ${wbudowana}` };
    let zepsuta = '';
    try { zepsuta = fs.readFileSync(path.join(dir, 'zepsuta'), 'utf8').trim(); } catch (e) { /* brak */ }
    if (zepsuta === wersja) return { dir: null, powod: `nakładka ${wersja} nie uruchomiła się poprawnie` };
    const znacznik = path.join(dir, 'start-' + wersja);
    if (fs.existsSync(znacznik)) {
      if (zapisz) { fs.writeFileSync(path.join(dir, 'zepsuta'), wersja); fs.rmSync(znacznik, { force: true }); }
      return { dir: null, powod: `nakładka ${wersja} nie uruchomiła się poprawnie` };
    }
    if (zapisz) fs.writeFileSync(znacznik, new Date().toISOString());
    return { dir, wersja, znacznik };
  } catch (e) {
    return { dir: null, powod: 'błąd nakładki: ' + e.message };
  }
}

module.exports = { porownajWersje, wybierzNakladke };
