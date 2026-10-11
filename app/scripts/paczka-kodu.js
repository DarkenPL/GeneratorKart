'use strict';
// Pliki aktualizacji do wydania (aktualizacje.js):
//   node scripts/paczka-kodu.js <folder>  →  <folder>/kod.zip i <folder>/aktualizacja.json
// kod.zip = pliki aplikacji z package.json → build.files (bez rozrusznika start.js) + zasoby/ (npm run zasoby).
// aktualizacja.json opisuje też pełną paczkę <folder>/KarKa.zip, jeśli istnieje (ditto z .app w CI).
// Opcja --wersja X nadpisuje wersję w paczce (tylko do testów).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');

const APP = path.join(__dirname, '..');
const argi = process.argv.slice(2);
const iw = argi.indexOf('--wersja');
const wersjaTestowa = iw >= 0 ? argi.splice(iw, 2)[1] : null;
const cel = path.resolve(argi[0] || path.join(APP, 'dist'));
const pk = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const wersja = wersjaTestowa || pk.version;
const electron = require(path.join(APP, 'node_modules', 'electron', 'package.json')).version;

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ROZRUSZNIK = ['start.js'];

(async () => {
  const zip = new JSZip();
  for (const plik of pk.build.files) {
    if (ROZRUSZNIK.includes(plik)) continue;
    if (plik === 'package.json') zip.file(plik, JSON.stringify({ ...pk, version: wersja }, null, 2) + '\n');
    else zip.file(plik, fs.readFileSync(path.join(APP, plik)));
  }
  const zasoby = path.join(APP, 'zasoby');
  if (!fs.existsSync(path.join(zasoby, 'karty.html'))) throw new Error('brak app/zasoby – najpierw npm run zasoby');
  const dodaj = (dir, rel) => {
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n), r = rel + '/' + n;
      if (fs.statSync(p).isDirectory()) dodaj(p, r); else zip.file(r, fs.readFileSync(p));
    }
  };
  dodaj(zasoby, 'zasoby');
  fs.mkdirSync(cel, { recursive: true });
  const kod = path.join(cel, 'kod.zip');
  fs.writeFileSync(kod, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));

  const manifest = { wersja, electron, data: new Date().toISOString(),
    kod: { plik: 'kod.zip', sha256: sha(kod), rozmiar: fs.statSync(kod).size } };
  const pelna = path.join(cel, 'KarKa.zip');
  if (fs.existsSync(pelna)) manifest.pelna = { plik: 'KarKa.zip', sha256: sha(pelna), rozmiar: fs.statSync(pelna).size };
  fs.writeFileSync(path.join(cel, 'aktualizacja.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(`kod.zip ${(manifest.kod.rozmiar / 1048576).toFixed(2)} MB` + (manifest.pelna ? `, KarKa.zip ${(manifest.pelna.rozmiar / 1048576).toFixed(0)} MB` : '') + `, wersja ${wersja}, Electron ${electron}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
