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
  eksportStart: () => ipcRenderer.invoke('eksport:start'),
  eksportPlik: (nazwa, dane) => ipcRenderer.invoke('eksport:plik', nazwa, dane),
  eksportKoniec: () => ipcRenderer.invoke('eksport:koniec'),
});
