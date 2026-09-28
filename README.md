# Kaffeerösterei

Browser-Idle-Spiel, Thema 1: Kaffeerösterei. Reines HTML, CSS und JavaScript (ES-Module), ohne Spiel-Engine und ohne Server. Das Ergebnis sind statische Dateien, ein Paket pro Ziel.

- Projektkontext und Regeln: [CLAUDE.md](CLAUDE.md)
- Umsetzungsplan: [docs/umsetzungsplan.md](docs/umsetzungsplan.md)
- Themenformat, Formeln und Balance-Simulator: [docs/themenformat.md](docs/themenformat.md)
- Entwürfe für die eigene Seite (Anleitung, Über uns, Datenschutz, Impressum): [docs/entwuerfe/](docs/entwuerfe/README.md)

Stand: Schritt 6 (Entwürfe für die eigene Seite). Das Spiel ist mit eigenen Texten (Englisch und Deutsch) und eigenen SVG-Grafiken spielbar, speichert im Browser und hat Belohnungen per Werbung, bisher nur simuliert. Arbeitstitel: **Roast & Rise**; er ist noch nicht auf Markenrechte geprüft. Entwürfe für Anleitung, Über uns, Datenschutz und Impressum liegen in `docs/entwuerfe/`.

## Voraussetzungen

- Node.js 22 oder neuer
- Einmalig `npm install`
- Für den Browser-Test auf dem eigenen Rechner einmalig `npx playwright install chromium`

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Startet einen lokalen Server auf http://127.0.0.1:8080/. Unter `/` läuft der Quellstand, unter `/dist/<ziel>/` das gebaute Paket. Mit `npm run dev -- --host 0.0.0.0` ist er auch vom Handy im selben WLAN erreichbar. |
| `npm test` | Unit-Tests mit dem eingebauten Node-Testrunner |
| `npm run sim` | Balance-Simulator: spielt das Thema durch und prüft Tempo und Zahlen (siehe [docs/themenformat.md](docs/themenformat.md)) |
| `npm run build` | Baut je Ziel ein Paket nach `dist/<ziel>/` |
| `npm run check:size` | Prüft jedes Paket: unter 2.000.000 Bytes und keine externen URLs |
| `npm run test:browser` | Browser-Test mit Playwright; baut vorher neu |
| `npm run check` | Führt alles nacheinander aus |

ES-Module laden nicht über `file://`. Zum Ausprobieren darum immer `npm run dev` nutzen, nicht die HTML-Datei direkt öffnen.

## Ziele

Die Ziele stehen in `config/targets.json`, derzeit `crazygames` und `web`:

- `runtime` landet als `src/config.js` im Paket (Thema, Werbe-Adapter, Spracherkennung).
- `languageDetection`:
  - `browser`: Sprache des Browsers, sonst Englisch.
  - `none`: Englisch. So verlangt es CrazyGames, solange das SDK keine Sprache liefert.
  - In beiden Fällen kann der Spieler die Sprache in den Einstellungen wechseln.
- `allowedUrls` ist die Ausnahmeliste für die URL-Prüfung, zum Beispiel für ein Werbe-SDK. Derzeit ist sie leer.

Zugangsdaten, Schlüssel und Publisher-IDs gehören nicht ins Repository, auch nicht in diese Datei.

## Ordner

| Ordner | Inhalt |
| --- | --- |
| `src/core/` | Wirtschaft (`economy.js`), Spielablauf (`game.js`), Speicherstand (`save.js`), Offline-Ertrag (`offline.js`), Werbe-Ablauf (`adflow.js`), Texte (`i18n.js`, `locales/`), Zahlenformat (`format.js`), Oberfläche (`ui/`) |
| `src/ads/` | Werbe-Schnittstelle und Adapter |
| `themes/kaffeeroesterei/` | Themendaten (`theme.json`), Texte (`locales/en.json`, `locales/de.json`; sie überschreiben gleichnamige Kerntexte), Farben (`theme.css`), SVG-Grafiken (`art/`) |
| `tools/` | Build, lokaler Server, Größen-Check, Balance-Simulator |
| `tests/unit/` | Unit-Tests (`*.test.js`) |
| `tests/fixtures/` | Testdaten, z. B. ein kleines Test-Thema mit nachrechenbaren Werten |
| `tests/browser/` | Browser-Tests (`*.spec.js`) |
| `config/` | Ziel-Konfiguration |
| `docs/` | Dokumentation |

## Speicherstand

- **Wo:** im `localStorage` des Browsers unter `<Thema>.save`, also `kaffeeroesterei.save`.
- **Wann:** beim Start, alle 10 Sekunden, solange die Seite sichtbar ist, außerdem beim Verbergen oder Verlassen der Seite, nach einem Prestige, nach dem Sprachwechsel und nach dem Zurücksetzen.
- **Ohne Speicher**, etwa im privaten Fenster: Das Spiel läuft weiter und weist darauf hin.
- **Unlesbarer Speicherstand:** Er wird unter `<Thema>.save:unreadable` beiseitegelegt, danach startet das Spiel neu. Liegt dort schon eine ältere Kopie, bleibt sie erhalten.
- **Spielstand einer neueren Version**, etwa wenn nach einem Update wieder eine alte Version ausgeliefert wird: Er bleibt unangetastet. Diese Version speichert dann nicht und sagt das.
- **Mehrere Tabs:** Es speichert nur der Tab, der zuletzt gespeichert hat. Ein älterer Tab hört auf zu speichern und bietet „Hier weiterspielen“ an; das lädt den neueren Stand.
- **Speichern schlägt später fehl**, etwa bei vollem Speicher: Das Spiel sagt es einmal und versucht es weiter.
- **Neues Speicherformat:** `SAVE_VERSION` in `src/core/save.js` erhöhen und eine Migration ergänzen.

## Werbung

- **Schnittstelle:** Werbung läuft nur über `src/ads/index.js`, mit den Funktionen `init`, `canShowRewarded`, `showRewarded` und `showInterstitial`. Welcher Adapter geladen wird, bestimmt `ads.adapter` im Ziel; ins Paket kommt nur dieser Adapter.
- **Adapter:**
  - `none`: kein Werbenetz. Mit `simulate: true` (nur in der Entwicklung) spielt er eine Anzeige von 0,8 s vor.
  - `crazygames`: Platzhalter für den Basic Launch, ohne SDK.
- **Wann Werbung erscheint** (`src/core/adflow.js`): Belohnungen nur auf Wunsch des Spielers, eine Zwischenanzeige nur nach einem Prestige, höchstens alle 5 Minuten und nicht in den ersten 5 Minuten nach dem Start. Solange eine Anzeige läuft, ist die Oberfläche gesperrt; ein Adapter, der nicht antwortet, gilt nach 2 Minuten als fertig.
- **CrazyGames:** Anforderungen und SDK-Notizen stehen in [docs/crazygames-sdk.md](docs/crazygames-sdk.md).

## Regeln für ausgelieferte Dateien

- Nur relative Pfade. CrazyGames verlangt das, und der Browser-Test lädt die Pakete deshalb aus einem Unterordner.
- Keine URLs zu fremden Servern. Ausnahmen gibt es nur über `allowedUrls` des Ziels. Weil der Build nicht minifiziert, zählen auch Links in Kommentaren; Doku-Links gehören darum nach `docs/`.
- Das Startpaket muss unter 2.000.000 Bytes bleiben.

## Pakete herunterladen

Die CI (GitHub Actions) führt bei jedem Pull Request alle Prüfungen aus, auch den Balance-Simulator und den Browser-Test in Chromium, Firefox und WebKit. Danach hängt sie die Pakete als Artefakte `package-crazygames` und `package-web` an den Lauf: im Reiter „Actions“ den Lauf öffnen, dann „Artifacts“. Jede ZIP-Datei enthält `index.html` direkt im Hauptordner.
