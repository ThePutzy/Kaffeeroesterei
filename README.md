# Kaffeerösterei

Browser-Idle-Spiel, Thema 1: Kaffeerösterei. Reines HTML, CSS und JavaScript (ES-Module), ohne Spiel-Engine und ohne Server. Das Ergebnis sind statische Dateien, ein Paket pro Ziel.

- Projektkontext und Regeln: [CLAUDE.md](CLAUDE.md)
- Umsetzungsplan: [docs/umsetzungsplan.md](docs/umsetzungsplan.md)
- Themenformat, Formeln und Balance-Simulator: [docs/themenformat.md](docs/themenformat.md)

Stand: Schritt 3a (Oberfläche). Das Spiel ist spielbar, speichert aber noch nicht; Speicherstand und Offline-Ertrag kommen in Schritt 3b. Die Inhalte sind noch vorläufig (IDs `g1` … `g8` statt Namen), die echten kommen in Schritt 5.

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
| `src/core/` | Wirtschaft (`economy.js`), Spielablauf (`game.js`), Texte (`i18n.js`, `locales/`), Zahlenformat (`format.js`), Oberfläche (`ui/`) |
| `src/ads/` | Werbe-Schnittstelle und Adapter |
| `themes/kaffeeroesterei/` | Themendaten (`theme.json`), Texte (`locales/en.json`, `locales/de.json`; sie überschreiben gleichnamige Kerntexte), später SVG-Grafiken |
| `tools/` | Build, lokaler Server, Größen-Check, Balance-Simulator |
| `tests/unit/` | Unit-Tests (`*.test.js`) |
| `tests/fixtures/` | Testdaten, z. B. ein kleines Test-Thema mit nachrechenbaren Werten |
| `tests/browser/` | Browser-Tests (`*.spec.js`) |
| `config/` | Ziel-Konfiguration |
| `docs/` | Dokumentation |

## Regeln für ausgelieferte Dateien

- Nur relative Pfade. CrazyGames verlangt das, und der Browser-Test lädt die Pakete deshalb aus einem Unterordner.
- Keine URLs zu fremden Servern. Ausnahmen gibt es nur über `allowedUrls` des Ziels. Weil der Build nicht minifiziert, zählen auch Links in Kommentaren; Doku-Links gehören darum nach `docs/`.
- Das Startpaket muss unter 2.000.000 Bytes bleiben.

## Pakete herunterladen

Die CI (GitHub Actions) führt bei jedem Pull Request alle Prüfungen aus, auch den Balance-Simulator und den Browser-Test in Chromium, Firefox und WebKit. Danach hängt sie die Pakete als Artefakte `package-crazygames` und `package-web` an den Lauf: im Reiter „Actions“ den Lauf öffnen, dann „Artifacts“. Jede ZIP-Datei enthält `index.html` direkt im Hauptordner.
