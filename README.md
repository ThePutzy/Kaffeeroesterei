# Kaffeerösterei

Browser-Idle-Spiel, Thema 1: Kaffeerösterei. Reines HTML, CSS und JavaScript (ES-Module), ohne Spiel-Engine und ohne Server. Das Ergebnis sind statische Dateien, ein Paket pro Ziel.

- Projektkontext und Regeln: [CLAUDE.md](CLAUDE.md)
- Umsetzungsplan: [docs/umsetzungsplan.md](docs/umsetzungsplan.md) (abgeschlossen)
- Plan für das neue Spiel: [docs/umsetzungsplan-neues-spiel.md](docs/umsetzungsplan-neues-spiel.md)
- Themenformat, Formeln und Balance-Simulator: [docs/themenformat.md](docs/themenformat.md)
- Entwürfe für die eigene Seite (Anleitung, Über uns, Datenschutz, Impressum): [docs/entwuerfe/](docs/entwuerfe/README.md)

Stand: Schritt 1 des [Plans für das neue Spiel](docs/umsetzungsplan-neues-spiel.md). Das Spiel ist jetzt die sichtbare Rösterei aus dem Prototyp: rösten, beim ersten Crack auswerfen, Gäste am Wagen bedienen, mit Helferin und Trommelröstern automatisieren. Englisch und Deutsch, Handy und Desktop. Der Inhalt reicht bis zum Café, etwa fünf Minuten. **Noch nicht wieder dabei:** Speicherstand und Offline-Ertrag (Schritt 2) und Belohnungen per Werbung (Schritt 3); ein Neuladen beginnt von vorn.

Titel, vorläufig: **Full Roast Ahead**; er ist nicht markenrechtlich geprüft ([Titelrecherche](docs/recherche/spieltitel.md)). Entwürfe für Anleitung, Über uns, Datenschutz und Impressum liegen in `docs/entwuerfe/`; sie beschreiben noch das Spiel vor der Neuausrichtung.

## Voraussetzungen

- Node.js 22 oder neuer
- Einmalig `npm install`
- Für den Browser-Test auf dem eigenen Rechner einmalig `npx playwright install chromium`

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Startet einen lokalen Server auf http://127.0.0.1:8080/. Unter `/` läuft der Quellstand, unter `/dist/<ziel>/` das gebaute Paket. Mit `npm run dev -- --host 0.0.0.0` ist er auch vom Handy im selben WLAN erreichbar; das nur in einem vertrauenswürdigen Netz, denn der Server liefert den Repository-Ordner aus (ohne versteckte Dateien wie `.git` und ohne `node_modules`). |
| `npm test` | Unit-Tests mit dem eingebauten Node-Testrunner |
| `npm run sim` | Balance-Simulator: spielt das Thema mit zwei gescripteten Spielern und prüft das Tempo (siehe [docs/themenformat.md](docs/themenformat.md)) |
| `npm run build` | Baut je Ziel ein Paket nach `dist/<ziel>/` |
| `npm run check:size` | Prüft jedes Paket: unter 2.000.000 Bytes, keine externen URLs (auch `ws://`, `wss://`, `ftp://`) und keine Symlinks |
| `npm run test:browser` | Browser-Test mit Playwright; baut vorher neu |
| `npm run check` | Führt alles nacheinander aus |

ES-Module laden nicht über `file://`. Zum Ausprobieren darum immer `npm run dev` nutzen, nicht die HTML-Datei direkt öffnen.

Hilfen zum Testen: `/?seed=1` spielt immer dasselbe Spiel (gleiche Gäste und Wünsche), `/?debug` stellt den Spielstand als `window.roastery` bereit.

## Ziele

Die Ziele stehen in `config/targets.json`, derzeit `crazygames` und `web`:

- `runtime` landet als `src/config.js` im Paket (Thema, Werbe-Adapter, Spracherkennung).
- `languageDetection`:
  - `browser`: Sprache des Browsers, sonst Englisch.
  - `none`: Englisch. So verlangt es CrazyGames, solange das SDK keine Sprache liefert.
  - In beiden Fällen kann der Spieler die Sprache in den Einstellungen wechseln.
- `allowedUrls` ist die Ausnahmeliste für die URL-Prüfung, zum Beispiel für ein Werbe-SDK. Ein Eintrag gilt für genau diese Herkunft (Schema, Host, Port) und alles unter seinem Pfad; `https://sdk.example.com` erlaubt also nicht `https://sdk.example.com.evil.test`. Derzeit ist die Liste leer.

Zugangsdaten, Schlüssel und Publisher-IDs gehören nicht ins Repository, auch nicht in diese Datei.

## Ordner

| Ordner | Inhalt |
| --- | --- |
| `src/core/` | Spielregeln (`model.js`), Oberfläche (`ui/app.js`), Ton (`audio.js`), Texte (`i18n.js`, `locales/`), Zahlenformat (`format.js`), Speicher-Grundlagen (`save.js`), Werbe-Ablauf (`adflow.js`) |
| `src/main.js` | Start: lädt das Thema, erzeugt Regeln, Szene und Oberfläche |
| `src/ads/` | Werbe-Schnittstelle und Adapter |
| `themes/kaffeeroesterei/` | Zahlen (`theme.json`), Texte (`locales/`), Szene als SVG-Code mit den Symbolen (`scene.js`), Farben (`theme.css`); Format: [docs/themenformat.md](docs/themenformat.md) |
| `tools/` | Build, lokaler Server, Größen-Check, Balance-Simulator |
| `tests/unit/` | Unit-Tests (`*.test.js`) |
| `tests/browser/` | Browser-Tests (`*.spec.js`) |
| `config/` | Ziel-Konfiguration |
| `docs/` | Dokumentation |

## Speicherstand

Das Spiel speichert derzeit nichts; ein Neuladen beginnt von vorn. Schritt 2 des Plans bringt den Speicherstand zurück. Die Grundlagen dafür bleiben in `src/core/save.js`:
- ein Speicherzugriff, der bei gesperrtem oder vollem Speicher nie abstürzt
- Versionsnummer und Migrationen
- Schutz vor dem Überschreiben eines Spielstands aus einer neueren Version
- ein unlesbarer Spielstand wird beiseitegelegt

## Werbung

- **Schnittstelle:** Werbung läuft nur über `src/ads/index.js`, mit den Funktionen `init`, `canShowRewarded`, `showRewarded` und `showInterstitial`. Welcher Adapter geladen wird, bestimmt `ads.adapter` im Ziel; ins Paket kommt nur dieser Adapter.
- **Adapter:**
  - `none`: kein Werbenetz. Mit `simulate: true` (nur in der Entwicklung) spielt er eine Anzeige von 0,8 s vor.
  - `crazygames`: Platzhalter für den Basic Launch, ohne SDK.
- **Wann Werbung erscheint:** derzeit gar nicht; das Spiel bietet noch keine Belohnungen an. Schritt 3 des Plans bringt Boost und Offline-Verdopplung nach den Regeln vom 30.09.2026 zurück (siehe [CLAUDE.md](CLAUDE.md)). Der Werbe-Ablauf `src/core/adflow.js` bleibt dafür bestehen: Belohnungen nur auf Wunsch des Spielers, keine Zwischenanzeigen, ein Adapter, der nicht antwortet, gilt nach 2 Minuten als fertig.
- **CrazyGames:** Anforderungen und SDK-Notizen stehen in [docs/crazygames-sdk.md](docs/crazygames-sdk.md).

## Regeln für ausgelieferte Dateien

- Nur relative Pfade. CrazyGames verlangt das, und der Browser-Test lädt die Pakete deshalb aus einem Unterordner.
- Keine URLs zu fremden Servern. Ausnahmen gibt es nur über `allowedUrls` des Ziels. Weil der Build nicht minifiziert, zählen auch Links in Kommentaren; Doku-Links gehören darum nach `docs/`.
- Das Startpaket muss unter 2.000.000 Bytes bleiben.

## Pakete herunterladen

Die CI (GitHub Actions) führt bei jedem Pull Request alle Prüfungen aus, auch den Balance-Simulator und den Browser-Test in Chromium, Firefox und WebKit. Danach hängt sie die Pakete als Artefakte `package-crazygames` und `package-web` an den Lauf: im Reiter „Actions“ den Lauf öffnen, dann „Artifacts“. Jede ZIP-Datei enthält `index.html` direkt im Hauptordner.
