'use strict';
// Rozrusznik aplikacji (główny plik w paczce). Uruchamia kod z nakładki (aktualizacja bez podmiany
// aplikacji – patrz nakladka.js i aktualizacje.js) albo kod z paczki. Ten plik i nakladka.js zmieniają się
// tylko z pełną aktualizacją, więc powinny zostać jak najprostsze.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { wybierzNakladke } = require('./nakladka');

const wbudowana = require('./package.json').version;
const FOLDER = path.join(app.getPath('userData'), 'kod');
const n = process.argv.includes('--bez-nakladki') ? { dir: null, powod: 'wyłączona (--bez-nakladki)' }
  : wybierzNakladke(FOLDER, { wbudowana, electron: process.versions.electron });

global.GENERATOR_KOD = n.dir
  ? { zrodlo: 'nakładka', dir: n.dir, wersja: n.wersja, znacznik: n.znacznik, wbudowana }
  : { zrodlo: 'paczka', dir: __dirname, wersja: wbudowana, wbudowana, powod: n.powod };

if (n.dir) {
  try {
    require(path.join(n.dir, 'main.js'));
  } catch (e) {
    // Nakładka nie wczytała się – zapamiętujemy to i uruchamiamy aplikację od nowa (wtedy z paczki).
    try { fs.writeFileSync(path.join(n.dir, 'zepsuta'), n.wersja); fs.rmSync(n.znacznik, { force: true }); } catch (e2) { /* trudno */ }
    console.error('Nakładka kodu nie działa:', e);
    app.relaunch();
    app.exit(0);
  }
} else {
  require('./main.js');
}
