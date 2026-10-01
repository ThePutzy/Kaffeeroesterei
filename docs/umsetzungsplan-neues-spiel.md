# Umsetzungsplan: das neue Spiel auf Basis des Prototyps

Stand: 01.10.2026. Der Nutzer hat entschieden, dass der Prototyp (`prototype/`) die Grundlage des neuen Spiels wird. Die Technik aus dem bisherigen Spiel wird übernommen. Was sonst gilt, steht in [CLAUDE.md](../CLAUDE.md); der erste Plan in [umsetzungsplan.md](umsetzungsplan.md) ist abgeschlossen.

## Ziel

Ein „Full Roast Ahead“, das für den Basic Launch auf CrazyGames taugt:
- sichtbare Rösterei mit der Röstcharge als Kernmechanik
- eine Kette mit sichtbarem Engpass und frühe Automatik
- ein erstes Prestige schon in der ersten Sitzung, als Umzug an einen neuen Standort
- Speicherstand und Offline-Ertrag
- Belohnungsanzeigen nach den Regeln vom 30.09.2026
- Englisch und Deutsch, Handy und Desktop

## Was bleibt und was wegfällt

**Übernommen aus dem bisherigen Spiel:**
- Speicherstand (`src/core/save.js`) mit Versionen, Schutz bei mehreren Tabs, Schutz vor neueren Versionen und Fehlerbehandlung
- Werbe-Schnittstelle und Adapter (`src/ads/`), Werbe-Ablauf (`src/core/adflow.js`)
- Sprachwahl und Texte (`src/core/i18n.js`), Zahlenformat (`src/core/format.js`)
- Build, lokaler Server, Größen-Check, CI und die Paket-Tests
- vom Offline-Ertrag die Regeln und der Dialog; die Berechnung wird für das neue Modell neu geschrieben

**Fällt weg:**
- Wirtschaftskern mit Erzeugerliste (`src/core/economy.js`, `src/core/game.js`)
- die alte Oberfläche (`src/core/ui/`)
- die alten Themendaten: Erzeuger, Upgrades, Erfolge
- der alte Balance-Simulator

Git behält den alten Stand. Erfolge kommen später zurück, wenn klar ist, was es im neuen Spiel zu erreichen gibt.

**Zielstruktur:**
- `src/core/`: Spielregeln (`model.js`, aus dem Prototyp), Ton, Oberfläche, Speicherstand, Offline-Ertrag, Werbe-Ablauf
- `themes/kaffeeroesterei/`:
  - `theme.json` mit Ausbau, Preisen, Zielen und Röstwerten
  - Texte EN und DE
  - die Szene als SVG-Code (`scene.js`)
  - Farben
- `tools/simulate.mjs`: neuer Simulator mit gescripteten Spielern (aktiv und gemütlich)

## Schritte

Jeder Schritt hat einen eigenen Branch und einen eigenen PR und beginnt, wenn der vorige gemergt ist. Vor jedem PR laufen Unit-Tests, Simulator, Build, Größen-Check und Browser-Test in Chromium, Firefox und WebKit. Der PR nennt, was geändert wurde und was nicht geprüft werden konnte.

### 1. Grundgerüst: Das Paket zeigt das neue Spiel

Branch `claude/neues-spiel-1-grundgeruest`

- Der Prototyp-Code zieht nach `src/core/` und `themes/kaffeeroesterei/` um.
- Die Texte kommen in die Sprachdateien, Sprache wie bisher nach Ziel-Einstellung.
- Die Zahlen kommen nach `theme.json`.
- Der Simulator prüft das Tempo der ersten fünf Minuten.
- Die alten Teile werden entfernt, `prototype/` wird aufgelöst.
- Speichern und Werbung fehlen in diesem Zwischenstand noch.

**Prüfung:**
- Unit-Tests für Modell, Texte und Build
- Simulator
- Browser-Test:
  - erste Charge und erster Kauf
  - Layout in den CrazyGames-Größen und hochkant
  - keine externen Anfragen

**Nicht prüfbar:** Spielgefühl, echte Geräte.

Der PR wird groß, weil viel verschoben und gelöscht wird. Neuer Code kommt kaum dazu.

### 2. Speicherstand und Offline-Ertrag

Branch `claude/neues-spiel-2-speichern`

- **Speichern:** Der Spielstand des neuen Modells wird gespeichert und geladen, mit neuer Speicherversion.
- **Alte Spielstände:** werden nicht übernommen; es gibt noch keine Spieler.
- **Offline-Ertrag:** Helferin und Maschinen arbeiten weiter, solange man weg ist. Gezahlt wird ein Anteil dessen, was die Automatik ohne Spieler pro Minute einbringt, mit Obergrenze.
- **Dialog:** „Willkommen zurück!“ wie bisher.

**Prüfung:**
- Unit-Tests für Speichern, Laden, Migration und Offline-Berechnung
- Browser-Test:
  - Neuladen behält den Stand
  - vorgespulte Abwesenheit zeigt den Dialog
  - gesperrter Speicher

### 3. Werbung nach den Regeln vom 30.09.2026

Branch `claude/neues-spiel-3-werbung`

- **Boost:** 10 Minuten. Die Uhr läuft nur, solange das Spiel sichtbar ist. Kein Stapeln, höchstens 6 pro Tag. Kauf als Alternative. Das Angebot steht in einem eigenen Bereich.
- **Offline-Verdopplung:** Kauf für die Hälfte des Offline-Ertrags als Alternative.
- **Zwischenanzeigen:** keine.
- **Gestaltung:** nach dem Design-Board.

**Prüfung:**
- Unit-Tests mit einem Test-Adapter
- Browser-Test:
  - gleiche Größe der Knöpfe
  - Tagesgrenze
  - Uhr steht, solange das Spiel verborgen ist
  - keine Anzeige ohne Klick
  - Pakete ohne Werbe-Knöpfe

### 4. Bis zum ersten Prestige: neuer Standort

Branch `claude/neues-spiel-4-standorte`

Aufgeteilt in zwei Pull Requests, weil einer zu groß würde (01.10.2026):
- **4a:** der Umzug selbst. Standorte in `theme.json`, Umzug mit Bonus und Zurücksetzen, das Hafenviertel als zweiter Standort, Simulator mit zweitem Durchgang. Der Umzug kommt vorerst kurz nach dem Café.
- **4b:** Inhalt zwischen Café und Umzug, Ziele bis dahin und das Balancing auf die Zielwerte unten. Umgesetzt: fünf neue Ausbauten und Ziele für Einnahmen; Umzug im Simulator nach etwa 15 Minuten aktivem und 17 Minuten gemütlichem Spiel.

- **Inhalt:** ab Minute fünf bis zum Umzug an einen neuen Standort, mit Zielen bis dahin.
- **Prestige:** ein Bonus, der den nächsten Durchgang spürbar schneller macht.
- **Balancing:** mit dem Simulator.

**Prüfung:**
- Simulator gegen die Zielwerte
- Unit-Tests für Umzug, Bonus und Zurücksetzen
- Browser-Test eines Umzugs

**Nicht prüfbar:** Ob sich das Tempo gut anfühlt.

### 5. Auftritt und Feinschliff für den Basic Launch

Branch `claude/neues-spiel-5-auftritt`

- **Logo:** das gewählte Logo vom Design-Board im Spiel. Eine Schrift kommt nur mit Open-Font-Lizenz und lokal ins Paket, nie von einem fremden Server.
- **Cover:** die drei Cover-Bilder als PNG für die Einreichung.
- **CrazyGames-Anforderungen:** erneut prüfen, darunter:
  - kein Startbildschirm
  - Lesbarkeit in den iframe-Größen
  - Sprache
- **Erfolge:** wenn sie dann passen.

## Zielwerte und offene Entscheidungen

Ohne andere Ansage des Nutzers gilt jeweils die Empfehlung:

- **Offline-Ertrag:** 50 % dessen, was die Automatik pro Minute einbringt, höchstens 8 Stunden. Das sind dieselben Werte wie im bisherigen Spiel.
- **Erstes Prestige:** bei aktivem Spiel nach etwa 15 bis 20 Minuten, bei gemütlichem nach höchstens 30 Minuten.
  - Grundlage: CrazyGames nennt für Clicker etwa 15 Minuten durchschnittliche Spielzeit, und erfolgreiche Spiele haben laut CrazyGames oft Sitzungen von 10 Minuten oder mehr.
  - Annahme: Ein Prestige in dieser Zeit fühlt sich in der ersten Sitzung erreichbar an.
- **Logo und Cover:** Die Auswahl trifft der Nutzer auf dem Design-Board in Claude Design („Full Roast Ahead – Design“).
- **Alte Spielstände:** werden nicht übernommen.
