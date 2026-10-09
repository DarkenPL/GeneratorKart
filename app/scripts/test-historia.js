'use strict';
// Test historii wersji (bez Electrona): node scripts/test-historia.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const H = require('../historia');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-'));
const pisz = (p, t) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), t); };
const czytaj = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
const MIN = 60000, T0 = Date.UTC(2026, 0, 1);

// 1) Kopia tylko przy zmianie treści.
pisz('Szablony/gra.txt', 'A');
pisz('karty.csv', 'ID;Nazwa\n1;x');
assert.strictEqual(H.zapisz(dir, ['Szablony/gra.txt', 'karty.csv'], { powod: 'otwarcie' }, T0), 2);
assert.strictEqual(H.zapisz(dir, ['Szablony/gra.txt', 'karty.csv'], null, T0 + MIN), 0);
pisz('Szablony/gra.txt', 'B');
assert.strictEqual(H.zapisz(dir, ['Szablony/gra.txt', 'karty.csv'], null, T0 + 2 * MIN), 1);

// 2) Ścieżki spoza projektu są pomijane.
assert.strictEqual(H.zapisz(dir, ['../poza.txt'], null, T0 + 3 * MIN), 0);

// 3) Przywrócenie stanu z otwarcia (A) + punkt „przed przywróceniem” (B zostaje w historii).
const zm = H.przywroc(dir, T0, T0 + 4 * MIN);
assert.deepStrictEqual(zm, ['Szablony/gra.txt']);
assert.strictEqual(czytaj('Szablony/gra.txt'), 'A');
const idx = H.wczytajIndeks(dir);
assert.ok(idx.punkty.some((p) => p.powod === 'przed przywróceniem'));
assert.strictEqual(H.stan(dir, T0 + 4 * MIN).find((s) => s.plik === 'Szablony/gra.txt').dane.toString(), 'B');

// 4) Przerzedzanie: 300 zmian co minutę przez 5 godzin → ostatnia godzina co 5 min, starsze co godzinę.
const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-'));
fs.writeFileSync(path.join(dir2, 'k.csv'), '0');
H.zapisz(dir2, ['k.csv'], { powod: 'punkt', etykieta: 'start' }, T0);
for (let i = 1; i <= 300; i++) { fs.writeFileSync(path.join(dir2, 'k.csv'), String(i)); H.zapisz(dir2, ['k.csv'], null, T0 + i * MIN); }
const w = H.wczytajIndeks(dir2).wersje;
assert.ok(w.length >= 14 && w.length <= 22, 'liczba kopii po przerzedzeniu: ' + w.length);
assert.ok(w.some((v) => v.czas === T0), 'kopia punktu „start” zostaje');
assert.ok(w.some((v) => v.czas === T0 + 300 * MIN), 'najnowsza zostaje');
assert.strictEqual(fs.readdirSync(path.join(dir2, H.FOLDER, 'pliki')).length, w.length, 'usunięte pliki kopii');
// Stan z punktu „start” da się odtworzyć.
assert.strictEqual(H.stan(dir2, T0)[0].dane.toString(), '0');

console.log('historia: OK (' + w.length + ' kopii po przerzedzeniu)');
