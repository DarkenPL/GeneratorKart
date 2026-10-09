#!/usr/bin/env node
'use strict';
// Historia wersji projektu z konsoli (Node 18+, bez Electrona). Ten sam format co aplikacja (historia.js).
//
//   node historia-cli.js punkt    <folder projektu> "opis"   – kopia zmienionych plików + punkt z opisem
//   node historia-cli.js lista    <folder projektu> [--json] – wersje i punkty, od najnowszych
//   node historia-cli.js przywroc <folder projektu> <nr>     – przywraca stan z pozycji listy (albo czasu w ms)
//
// Folder projektu może być też podany jako plik szablonu albo folder Szablony.
const fs = require('fs');
const path = require('path');
const historia = require('./historia');

const blad = (t) => { process.stderr.write('Błąd: ' + t + '\n'); process.exit(1); };

function folderProjektu(p) {
  if (!p) blad('podaj folder projektu');
  let f = path.resolve(p);
  if (!fs.existsSync(f)) blad('nie ma ' + f);
  if (fs.statSync(f).isFile()) f = path.dirname(f);
  if (path.basename(f).toLowerCase() === 'szablony') f = path.dirname(f);
  return f;
}

// Pliki do historii: szablony (pliki .txt z KARTA/DANE w Szablony/ i w folderze projektu),
// pliki z komend DANE oraz wszystko, co historia już śledzi.
function plikiProjektu(projekt) {
  const pliki = new Set(historia.wczytajIndeks(projekt).wersje.map((v) => v.plik));
  const szablony = [];
  for (const dir of ['Szablony', '']) {
    let nazwy = [];
    try { nazwy = fs.readdirSync(path.join(projekt, dir)); } catch (e) { continue; }
    for (const n of nazwy) {
      if (!/\.txt$/i.test(n)) continue;
      const rel = dir ? dir + '/' + n : n;
      const tekst = fs.readFileSync(path.join(projekt, rel), 'utf8');
      if (/^\s*(KARTA|DANE)\s*=/mi.test(tekst)) { szablony.push(rel); pliki.add(rel); }
      for (const m of tekst.matchAll(/^\s*DANE\s*=\s*([^;\n]+)/gmi))
        for (let d of m[1].split(',')) {
          d = d.trim().replace(/^"|"$/g, '').replace(/\s*#.*$/, '');
          if (d && fs.existsSync(path.join(projekt, d))) pliki.add(d.split(path.sep).join('/'));
        }
    }
  }
  if (!szablony.length) blad('w ' + projekt + ' nie znaleziono szablonu (pliku .txt z KARTA albo DANE)');
  return [...pliki].filter((p) => fs.existsSync(path.join(projekt, p)));
}

const data = (t) => new Date(t).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const OPIS = { otwarcie: 'otwarcie projektu', 'przed przywróceniem': 'stan sprzed przywrócenia' };

function lista(projekt) {
  const { wersje, punkty } = historia.wczytajIndeks(projekt);
  const chwile = new Map();
  const c = (t) => chwile.get(t) || chwile.set(t, { czas: t, pliki: [], punkty: [] }).get(t);
  for (const v of wersje) c(v.czas).pliki.push(v.plik);
  for (const p of punkty) c(p.czas).punkty.push(p.etykieta || OPIS[p.powod] || p.powod);
  return [...chwile.values()].sort((a, b) => b.czas - a.czas).map((x, i) => ({ nr: i + 1, ...x }));
}

const [polecenie, folder, ...reszta] = process.argv.slice(2);
if (!polecenie || ['-h', '--help', 'pomoc'].includes(polecenie)) {
  process.stdout.write(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
  process.exit(0);
}
const projekt = folderProjektu(folder);

if (polecenie === 'punkt') {
  const opis = reszta.join(' ').trim();
  if (!opis) blad('podaj opis punktu, np. "Claude: przed zmianą efektów"');
  const pliki = plikiProjektu(projekt);
  const nowe = historia.zapisz(projekt, pliki, { powod: 'punkt', etykieta: opis });
  console.log(`Punkt „${opis}” zapisany (${pliki.length} plików, nowe kopie: ${nowe}).`);
} else if (polecenie === 'lista') {
  const l = lista(projekt);
  if (reszta.includes('--json')) { console.log(JSON.stringify(l, null, 1)); process.exit(0); }
  if (!l.length) console.log('Historia jest pusta.');
  for (const x of l) console.log(`${String(x.nr).padStart(3)}  ${data(x.czas)}  ` +
    (x.punkty.length ? '[' + x.punkty.join('; ') + '] ' : '') + (x.pliki.length ? 'kopie: ' + x.pliki.join(', ') : ''));
} else if (polecenie === 'przywroc' || polecenie === 'przywróć') {
  const arg = Number(reszta[0]);
  if (!arg) blad('podaj numer z listy (historia-cli.js lista …) albo czas w ms');
  const l = lista(projekt);
  const czas = arg <= l.length ? l[arg - 1].czas : arg;
  const zmienione = historia.przywroc(projekt, czas);
  console.log(zmienione.length ? `Przywrócono stan z ${data(czas)}: ${zmienione.join(', ')}` : 'Ten stan nie różni się od obecnego.');
} else blad('nieznane polecenie „' + polecenie + '” (punkt, lista, przywroc)');
