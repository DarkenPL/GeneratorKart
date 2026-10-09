'use strict';
// Most między stroną (karty.html) a aplikacją. Strona sprawdza `window.generatorApp`,
// żeby pokazać przyciski dostępne tylko w aplikacji.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('generatorApp', {
  info: () => ipcRenderer.invoke('projekt:info'),
  otworzSzablon: () => ipcRenderer.invoke('projekt:otworz'),
  nowyProjekt: () => ipcRenderer.invoke('projekt:nowy'),
  przyklady: () => ipcRenderer.invoke('projekt:przyklady'),
  otworzPrzyklad: (nazwa) => ipcRenderer.invoke('projekt:przyklad', nazwa),
  pokazFolder: () => ipcRenderer.invoke('projekt:pokaz'),
  zapiszPdf: (nazwa) => ipcRenderer.invoke('pdf:zapisz', nazwa),
  zapiszSzablon: (tekst) => ipcRenderer.invoke('edytor:zapisz', tekst),
  edytorZmiany: (czy) => ipcRenderer.invoke('edytor:zmiany', !!czy),
  odciski: () => ipcRenderer.invoke('druk:odciski'),
  zapiszOdciski: (dane) => ipcRenderer.invoke('druk:zapiszOdciski', dane),
  historiaZapisz: (pliki, punkt) => ipcRenderer.invoke('historia:zapisz', pliki, punkt),
  historiaLista: () => ipcRenderer.invoke('historia:lista'),
  historiaStan: (czas) => ipcRenderer.invoke('historia:stan', czas),
  naZmianeHistorii: (fn) => ipcRenderer.on('historia:zmiana', () => fn()),
  historiaPrzywroc: (czas) => ipcRenderer.invoke('historia:przywroc', czas),
  zapiszPcio: (nazwa, dane) => ipcRenderer.invoke('pcio:zapisz', nazwa, dane),
  eksportUstawienia: () => ipcRenderer.invoke('eksport:ustawienia'),
  zapiszEksportUstawienia: (dane) => ipcRenderer.invoke('eksport:zapiszUstawienia', dane),
  eksportStart: () => ipcRenderer.invoke('eksport:start'),
  eksportPlik: (nazwa, dane) => ipcRenderer.invoke('eksport:plik', nazwa, dane),
  eksportKoniec: () => ipcRenderer.invoke('eksport:koniec'),
});
