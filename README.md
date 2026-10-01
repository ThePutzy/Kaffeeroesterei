# Kaffeerösterei

Browser-Idle-Spiel, Thema 1: Kaffeerösterei. Reines HTML, CSS und JavaScript (ES-Module), ohne Spiel-Engine und ohne Server. Das Ergebnis sind statische Dateien, ein Paket pro Ziel.

- Projektkontext und Regeln: [CLAUDE.md](CLAUDE.md)
- Umsetzungsplan: [docs/umsetzungsplan.md](docs/umsetzungsplan.md) (abgeschlossen)
- Plan für das neue Spiel: [docs/umsetzungsplan-neues-spiel.md](docs/umsetzungsplan-neues-spiel.md)
- Themenformat, Formeln und Balance-Simulator: [docs/themenformat.md](docs/themenformat.md)
- Entwürfe für die eigene Seite (Anleitung, Über uns, Datenschutz, Impressum): [docs/entwuerfe/](docs/entwuerfe/README.md)

Stand: Schritt 3 des [Plans für das neue Spiel](docs/umsetzungsplan-neues-spiel.md). Das Spiel ist die sichtbare Rösterei aus dem Prototyp: rösten, beim ersten Crack auswerfen, Gäste am Wagen bedienen, mit Helferin und Trommelröstern automatisieren. Englisch und Deutsch, Handy und Desktop. Der Inhalt reicht bis zum Café, etwa fünf Minuten. Das Spiel speichert im Browser, zahlt einen Offline-Ertrag und bietet Boost und Offline-Verdopplung an, per Werbung oder als Kauf.

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
| `src/core/` | Spielregeln (`model.js`), Oberfläche (`ui/app.js`), Ton (`audio.js`), Texte (`i18n.js`, `locales/`), Zahlenformat (`format.js`), Speicherstand (`save.js`), Offline-Ertrag (`offline.js`), Werbe-Ablauf (`adflow.js`) |
| `src/main.js` | Start: lädt Thema und Spielstand, erzeugt Regeln, Szene und Oberfläche, speichert und rechnet die Zeit ohne Bilder nach |
| `src/ads/` | Werbe-Schnittstelle und Adapter |
| `themes/kaffeeroesterei/` | Zahlen (`theme.json`), Texte (`locales/`), Szene als SVG-Code mit den Symbolen (`scene.js`), Farben (`theme.css`); Format: [docs/themenformat.md](docs/themenformat.md) |
| `tools/` | Build, lokaler Server, Größen-Check, Balance-Simulator |
| `tests/unit/` | Unit-Tests (`*.test.js`) |
| `tests/browser/` | Browser-Tests (`*.spec.js`) |
| `config/` | Ziel-Konfiguration |
| `docs/` | Dokumentation |

## Speicherstand

- **Wo:** im `localStorage` des Browsers unter `kaffeeroesterei.save`. Gespeichert werden Geld, Ausbau, Säcke im Wagen, Statistiken, das aktuelle Ziel, die Restzeit eines Boosts, die Boosts per Werbung am aktuellen Tag und die Einstellungen, die der Spieler gewählt hat (Sprache, Ton). Gäste auf der Straße und Chargen im Röster beginnen nach dem Laden neu.
- **Wann:** beim Start, alle 10 Sekunden, solange das Spiel sichtbar ist, wenn der Tab verborgen oder geschlossen wird, nach jedem Kauf und nach dem Wechsel von Sprache oder Ton.
- **Version 2:** Spielstände des ersten Spiels (Version 1) werden nicht übernommen, sondern unter `kaffeeroesterei.save:unreadable` beiseitegelegt.
- **Neu starten:** löscht den Fortschritt, die Einstellungen bleiben.
- **Fehlerfälle** (`src/core/save.js`):
  - Gesperrter Speicher, etwa im privaten Fenster: Das Spiel läuft und sagt im Seitenbereich, dass es nicht speichert.
  - Voller Speicher: ein Hinweis beim ersten Fehlschlag; das Spiel versucht es weiter.
  - Spielstand aus einer neueren Version: Er bleibt unangetastet, diese Version speichert nicht und sagt das.
  - Unlesbarer Spielstand: Er wird beiseitegelegt, das Spiel beginnt neu.
  - Zweiter Tab: Der Tab, der zuletzt gespeichert hat, gehört der Spielstand. Der ältere Tab hält an, speichert nicht mehr und bietet „Hier weiterspielen“ an; das lädt den neuesten Stand.

## Offline-Ertrag

Die Zeit, in der das Spiel nicht läuft, rechnet `src/main.js` nach: beim Start ab dem gespeicherten Zeitpunkt, im laufenden Spiel, sobald nach einem verborgenen Tab oder einem schlafenden Gerät wieder Bilder kommen.

- **Bis 60 Sekunden** (`offline.minAwaySeconds`): Das Spiel läuft diese Zeit ohne Ton und Effekte nach, als wäre der Tab offen gewesen.
- **Länger:** Das Spiel zahlt einen Offline-Ertrag (`src/core/offline.js`) und zeigt „Willkommen zurück!“.
  - Grundlage ist, was die Automatik ohne Spieler pro Minute einbringt: Die Spielregeln spielen dafür eine Kopie des Spielstands ohne Eingaben, erst 30 Sekunden zum Einschwingen, dann 120 Sekunden zum Messen.
  - Davon gibt es 50 % (`offline.rate`), höchstens für 8 Stunden (`offline.maxHours`).
  - Ohne Helferin oder Trommelröster bringt die Automatik nichts, dann erscheint auch kein Dialog.
  - Eine zurückgestellte Uhr zahlt nichts.
- **Der Spielstand selbst** läuft in dieser Zeit nicht weiter: Gäste, Röster und Sonderlieferung stehen danach dort, wo sie waren.

## Werbung

- **Schnittstelle:** Werbung läuft nur über `src/ads/index.js`, mit den Funktionen `init`, `canShowRewarded`, `showRewarded` und `showInterstitial`. Welcher Adapter geladen wird, bestimmt `ads.adapter` im Ziel; ins Paket kommt nur dieser Adapter.
- **Adapter:**
  - `none`: kein Werbenetz. Mit `simulate: true` (nur in der Entwicklung) spielt er eine Anzeige von 0,8 s vor.
  - `crazygames`: Platzhalter für den Basic Launch, ohne SDK.
- **Wann Werbung erscheint:** nur nach einem Klick auf einen Knopf mit Video-Symbol, nach den Regeln vom 30.09.2026 (siehe [CLAUDE.md](CLAUDE.md)). Zwischenanzeigen gibt es keine.
  - **Boost:** doppelte Verkaufspreise für 10 Minuten, angeboten ab der Helferin in einer eigenen Karte oben im Seitenbereich.
    - Die Restzeit läuft nur, solange man das Spiel sieht.
    - Kein Stapeln, höchstens 6 Boosts per Werbung pro Kalendertag.
    - Als Kauf kostet er so viel, wie die Automatik in 5 Minuten einbringt.
  - **Offline-Ertrag verdoppeln:** im Dialog „Willkommen zurück!“, einmal je Rückkehr, per Werbung oder als Kauf für die Hälfte des Betrags.
  - **Während einer Anzeige** steht das Spiel still, der Ton ist aus, und ein Dialog sperrt die Bedienung.
  - **Ablauf** (`src/core/adflow.js`): nur eine Anzeige zur Zeit, die Belohnung erst nach einer gesehenen Anzeige. Ein Adapter, der nicht antwortet, gilt nach 2 Minuten als fertig, ohne Belohnung.
  - **Ohne Werbenetz**, also derzeit in beiden Paketen: Die Werbe-Knöpfe bleiben ausgeblendet, die Käufe bleiben.
- **CrazyGames:** Anforderungen und SDK-Notizen stehen in [docs/crazygames-sdk.md](docs/crazygames-sdk.md).

## Regeln für ausgelieferte Dateien

- Nur relative Pfade. CrazyGames verlangt das, und der Browser-Test lädt die Pakete deshalb aus einem Unterordner.
- Keine URLs zu fremden Servern. Ausnahmen gibt es nur über `allowedUrls` des Ziels. Weil der Build nicht minifiziert, zählen auch Links in Kommentaren; Doku-Links gehören darum nach `docs/`.
- Das Startpaket muss unter 2.000.000 Bytes bleiben.

## Pakete herunterladen

Die CI (GitHub Actions) führt bei jedem Pull Request alle Prüfungen aus, auch den Balance-Simulator und den Browser-Test in Chromium, Firefox und WebKit. Danach hängt sie die Pakete als Artefakte `package-crazygames` und `package-web` an den Lauf: im Reiter „Actions“ den Lauf öffnen, dann „Artifacts“. Jede ZIP-Datei enthält `index.html` direkt im Hauptordner.
