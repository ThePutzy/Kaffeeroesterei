# Themenformat und Balancing

Das beschreibt, woraus ein Thema besteht, wie die Spielregeln (`src/core/model.js`) seine Zahlen nutzen und wie der Balance-Simulator (`tools/simulate.mjs`) das Tempo prüft. Stand: 01.10.2026, Schritt 2 des [Plans für das neue Spiel](umsetzungsplan-neues-spiel.md).

## Was zu einem Thema gehört

| Datei im Themenordner | Inhalt |
| --- | --- |
| `theme.json` | alle Zahlen: Röstgrade, Röster, Preise, Gäste, Sonderlieferung, Ausbau, Ziele, Offline-Ertrag, Simulator-Einstellungen |
| `locales/en.json`, `locales/de.json` | die Texte des Themas. Sie überschreiben gleichnamige Kerntexte aus `src/core/locales/`. |
| `scene.js` | die Szene als SVG-Code, dazu die Symbole für den Ausbau (`ITEM_ICONS`) und die Münze (`COIN_ICON`). Die Szene importiert nichts; das Spiel übergibt ihr den ersten Crack, die Plätze der Gäste und die Röstgrade mit ihren Farben. |
| `theme.css` | die Farben als CSS-Variablen (`--ui-*`, `--gold`, `--teal` …). Das Stylesheet des Spiels (`src/styles.css`) benutzt nur diese Variablen. |

Die Mechanik selbst gehört zum Spielkern: Röstcharge, erster und zweiter Crack, Abkühlen, Wagen, Schlange, Wünsche der Gäste, Automatik, Sonderlieferung und Ziele.

## theme.json

| Feld | Bedeutung |
| --- | --- |
| `id` | Name des Themenordners |
| `stylesheet`, `scene` | Dateinamen im Themenordner, siehe oben |
| `roast.firstCrack`, `roast.secondCrack` | Röstfortschritt (0 bis 1) des ersten und zweiten Cracks. Vor dem ersten Crack kann man nicht auswerfen. |
| `roast.levels[]` | Röstgrade in aufsteigender Reihenfolge: `id`, `until` (Ende des Bereichs; der erste beginnt beim ersten Crack, der letzte endet bei 1), `target` (wo die Automatik auswirft), `wish` (Gewicht, wie oft Gäste ihn wünschen), `color` (Farbe von Etikett, Skala und Sprechblase) |
| `roast.defaultLevel` | Röstgrad, den die Automatik ohne Röstprofil röstet |
| `roasters.<art>` | `roastSeconds` (Dauer einer Charge ohne Rühren), `tapHeat` (Fortschritt je Rühren), `coolSeconds`, `loadDelay` (Pause, bis die Automatik neu befüllt), `bags` (Säcke je Charge). `pan` ist Pflicht; weitere Arten kauft man über den Ausbau. |
| `sales` | `basePrice` (Preis je Sack), `matchFactor` (Faktor bei getroffenem Wunsch), `capacity` (Plätze im Wagen), `incomeWindowSeconds` (Zeitraum für die Anzeige „pro Minute“) |
| `guests` | `firstArrival`, `arrivalSeconds` (mittlerer Abstand), `arrivalSpread` (Schwankung, 0,5 heißt ±25 %), `firstWish` (Wunsch des ersten Gasts, der schon wartet), `buySeconds`, `walkSpeed` sowie die Positionen in Szenen-Einheiten: `slots` (Plätze in der Schlange), `spawnX`, `turnX`, `exitX` |
| `delivery` | Sonderlieferung: `firstAt`, `gapSeconds` ([kürzester, längster] Abstand), `waitSeconds`, `speed`, `stopX`, `offstageX`, `rewardIncomeSeconds` (Belohnung: so viele Sekunden des aktuellen Ertrags), `minReward` |
| `items[]` | Ausbau: `id`, `cost` (Preise der Reihe nach; nur Röster gibt es mehrmals), optional `reveal` (Bedingung, ab der man ihn sieht), `effects` |
| `goals[]` | Ziele in Reihenfolge: `id`, `reward`, `done` (Bedingung) |
| `goalPauseSeconds` | Pause zwischen zwei Zielen, in der „Geschafft!“ steht |
| `offline` | Offline-Ertrag: `rate` (Anteil, über 0 bis 1), `maxHours` (Obergrenze), `minAwaySeconds` (kürzere Pausen laufen als normales Spiel nach, statt Offline-Ertrag zu zahlen), `warmupSeconds` und `sampleSeconds` (wie lange die Spielregeln eine Kopie des Spielstands ohne Spieler einschwingen lassen und dann messen, siehe unten) |
| `simulation` | Einstellungen des Simulators, siehe unten |

**Effekte des Ausbaus** (gelten, sobald man das Teil mindestens einmal besitzt):

| Effekt | Wirkung |
| --- | --- |
| `panBags` | Säcke je Pfannen-Charge; der größte Wert zählt |
| `capacity` | Plätze im Wagen; der größte Wert zählt |
| `priceFactor` | multipliziert den Preis je Sack |
| `arrivalFactor` | multipliziert den Abstand zwischen zwei Gästen; unter 1 kommen sie öfter |
| `panAutomatic` | die Pfanne röstet und wirft von selbst aus |
| `followWishes` | die Automatik röstet, was der erste Gast ohne passenden Sack im Wagen wünscht |
| `roaster` | jeder Kauf stellt einen weiteren Röster dieser Art auf (`roasters.<art>`) |

**Bedingungen** haben entweder `stat` oder `owned`, optional `min` (Standard 1):
- `{ "stat": "sales" }`: so viele Verkäufe. Statistiken: `taps`, `manualEjects`, `ejects`, `sales`, `matched`, `lost`, `revenue`.
- `{ "owned": "helper" }`: so viele Stück dieses Ausbaus.

`validateTheme()` in `src/core/model.js` prüft das alles beim Start. Ein Fehler stoppt das Spiel mit einer Meldung, statt mit falschen Zahlen zu laufen.

## Speicherstand und Offline-Ertrag

- **Speicherstand:** `serializeState()` schreibt Zeit, Geld, Zufallszahl, Ausbau, Säcke im Wagen, Statistiken, Ziel und die nächste Sonderlieferung. `sanitizeState()` prüft einen geladenen Stand und gibt `null` zurück, wenn er nicht passt. Unbekannte Teile des Ausbaus und Röstgrade fallen weg; Mengen werden auf das begrenzt, was das Thema zulässt (Käufe je Teil, Plätze im Wagen, Zahl der Ziele). Gäste und laufende Chargen beginnen nach dem Laden neu.
- **Offline-Ertrag:** `automaticIncomePerMinute()` spielt eine Kopie des Spielstands ohne Eingaben, erst `offline.warmupSeconds`, dann `offline.sampleSeconds`, und misst die Einnahmen der zweiten Phase. `src/core/offline.js` zahlt davon `offline.rate` für die Zeit weg, höchstens `offline.maxHours` Stunden.
- **Spielstand bei Abwesenheit:** Er läuft in dieser Zeit nicht weiter; Gäste, Röster und Sonderlieferung stehen danach dort, wo sie waren.

## Texte

- Kerntexte in `src/core/locales/` decken allgemeine Knöpfe und Meldungen ab, etwa Einstellungen, Neustart, „pro Minute“ und den Ausbau.
- **Das Thema bringt mit:**
  - den Titel
  - zu jedem Ausbau `items.<id>.name` und `.effect`
  - zu jedem Ziel `goals.<id>`
  - zu jedem Röstgrad `levels.<id>`
  - die Texte von Skala, Status, Übersicht, Einblendungen und Bannern
- **Platzhalter** wie `{value}` müssen in beiden Sprachen gleich sein. Das prüft ein Unit-Test.
- **Fehlende Texte:** Fehlt ein Text, zeigt das Spiel den Schlüssel und meldet ihn in der Konsole. Damit schlägt auch der Browser-Test an.

## Balance-Simulator

`npm run sim` spielt das Thema mit zwei gescripteten Spielern und mehreren Seeds (`simulation.seeds`) bis `simulation.seconds`:
- **aktiv:** rührt dreimal pro Sekunde und wirft aus, wenn die Röstung zum Wunsch des ersten Gasts passt.
- **gemütlich:** rührt nie und wirft nur von Hand aus, bis die Automatik das übernimmt.

Beide kaufen, was das aktuelle Ziel verlangt, danach alles, was sie sich leisten können, und tippen auf die Sonderlieferung. Das sind Annahmen, keine Messungen echter Spieler.

**Ausgabe:**
- je Spieler der früheste und späteste Zeitpunkt über alle Seeds für den ersten Verkauf, jeden Ausbau und das Ende der Ziele
- die längste Wartezeit ohne Fortschritt
- was die Automatik am Ende ohne Spieler pro Minute einbringt (`auto per min`) und was das als Offline-Ertrag für die volle Obergrenze ergibt (`offline 8 h`)

**Harte Fehler** beenden mit Code 1:
- Geld wird ungültig oder negativ.
- Länger als `simulation.maxSecondsWithoutProgress` gibt es keinen Kauf und kein erreichtes Ziel, obwohl noch etwas offen ist.
- Das Thema ist ungültig.

**Warnungen:** Zeitpunkte außerhalb von `simulation.targets` (je Spieler und Meilenstein `[frühestens, spätestens]` in Sekunden).

**Stand 01.10.2026:**
- aktiv: Café nach 4:11 bis 4:24
- gemütlich: Café nach 5:01 bis 5:24
- keine Warnungen
- Automatik am Ende: 343 bis 361 pro Minute, also etwa 82.000 bis 87.000 für 8 Stunden offline. Das ist weit mehr als der teuerste Ausbau (400). Solange das Spiel nach dem Café endet, fällt das nicht ins Gewicht; Schritt 4 muss Preise und Offline-Ertrag zusammen einstellen.
