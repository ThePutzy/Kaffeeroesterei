# Themenformat und Balancing

Das beschreibt, woraus ein Thema besteht, wie die Spielregeln (`src/core/model.js`) seine Zahlen nutzen und wie der Balance-Simulator (`tools/simulate.mjs`) das Tempo prüft. Stand: 02.10.2026, nach den strengen Wünschen, den einstellbaren Trommelröstern und dem Espresso (nach Schritt 5b des [Plans für das neue Spiel](umsetzungsplan-neues-spiel.md)).

## Was zu einem Thema gehört

| Datei im Themenordner | Inhalt |
| --- | --- |
| `theme.json` | alle Zahlen: Röstgrade, Röster, Preise, Gäste, Sonderlieferung, Ausbau, Ziele, Offline-Ertrag, Boost, Standorte, Simulator-Einstellungen |
| `locales/en.json`, `locales/de.json` | die Texte des Themas. Sie überschreiben gleichnamige Kerntexte aus `src/core/locales/`. |
| `scene.js` | die Szene als SVG-Code, dazu die Symbole für den Ausbau (`ITEM_ICONS`), für die Standorte, in die man umziehen kann (`LOCATION_ICONS`), und für die Münze (`COIN_ICON`). Die Szene importiert nichts; das Spiel übergibt ihr den ersten Crack, die Plätze der Gäste und die Röstgrade mit ihren Farben. |
| `theme.css` | die Farben als CSS-Variablen (`--ui-*`, `--gold`, `--teal` …). Das Stylesheet des Spiels (`src/styles.css`) benutzt nur diese Variablen. |
| `logo.svg` | das Logo, mit den Buchstaben als Pfaden statt als Text, damit keine Schrift geladen werden muss. `index.html` zeigt es, solange das Spiel lädt, und `tools/media.mjs` setzt es auf die Cover. |
| `icon.svg` | das quadratische Symbol des Logos, als Symbol im Browser-Tab |

`index.html` nennt den Themenordner für Logo und Symbol direkt, denn beide müssen sichtbar sein, bevor das Spiel sein Thema lädt. Ein Ziel mit einem anderen Thema bräuchte darum eine eigene Seite; ein Unit-Test erinnert daran.

Die Mechanik selbst gehört zum Spielkern: Röstcharge, erster und zweiter Crack, Abkühlen, Wagen mit seinen Fächern, Schlange, Wünsche und Geduld der Gäste, Automatik, Espressomaschine, Sonderlieferung und Ziele.

## theme.json

| Feld | Bedeutung |
| --- | --- |
| `id` | Name des Themenordners |
| `stylesheet`, `scene` | Dateinamen im Themenordner, siehe oben |
| `roast.firstCrack`, `roast.secondCrack` | Röstfortschritt (0 bis 1) des ersten und zweiten Cracks. Vor dem ersten Crack kann man nicht auswerfen. |
| `roast.levels[]` | Röstgrade in aufsteigender Reihenfolge: `id`, `until` (Ende des Bereichs; der erste beginnt beim ersten Crack, der letzte endet bei 1), `target` (wo die Automatik auswirft), `wish` (Gewicht, wie oft Gäste ihn wünschen), `color` (Farbe von Etikett, Skala und Sprechblase) |
| `roast.defaultLevel` | Röstgrad, auf dem ein neuer Trommelröster ohne Röstprofil steht. Die Automatik wirft bei ihm aus, wenn sie keinen gewünschten Röstgrad mehr erreichen kann. |
| `roasters.<art>` | `roastSeconds` (Dauer einer Charge ohne Rühren), `tapHeat` (Fortschritt je Rühren), `coolSeconds`, `loadDelay` (Pause, bis die Automatik neu befüllt), `bags` (Säcke je Charge). `pan` ist Pflicht; weitere Arten kauft man über den Ausbau. |
| `sales` | `basePrice` (Preis je Sack, vor dem Runden), `capacity` (Säcke je Fach; der Wagen hat ein Fach je Röstgrad), `incomeWindowSeconds` (Zeitraum für die Anzeige „pro Minute“) |
| `guests` | `firstArrival`, `arrivalSeconds` (mittlerer Abstand), `arrivalSpread` (Schwankung, 0,5 heißt ±25 %), `firstWish` (Wunsch des ersten Gasts, der schon wartet), `buySeconds`, `walkSpeed`, `patienceSeconds` (so lange wartet ein Gast in der Schlange auf seinen Röstgrad, siehe unten) sowie die Positionen in Szenen-Einheiten: `slots` (Plätze in der Schlange), `spawnX`, `turnX`, `exitX` |
| `espresso` | Espresso, nötig, sobald ein Ausbau den Effekt `espresso` hat: `share` (Anteil der Gäste, die dann Espresso bestellen, über 0 bis unter 1), `brewSeconds` (so lange braucht die Maschine allein für eine Tasse), `tapBrew` (Anteil einer Tasse je Antippen), `cups` (so viele fertige Tassen stehen höchstens neben der Maschine), `basePrice` (Preis je Espresso, vor dem Runden) |
| `delivery` | Sonderlieferung: `firstAt`, `gapSeconds` ([kürzester, längster] Abstand), `waitSeconds`, `speed`, `stopX`, `offstageX`, `rewardIncomeSeconds` (Belohnung: so viele Sekunden des aktuellen Ertrags), `minReward` |
| `items[]` | Ausbau: `id`, `cost` (Preise der Reihe nach; nur Röster gibt es mehrmals), optional `reveal` (Bedingung, ab der man ihn sieht), `effects` |
| `goals[]` | Ziele in Reihenfolge: `id`, `reward`, `done` (Bedingung), optional `tutorial: true` (nur im ersten Durchgang; nach einem Umzug übersprungen) |
| `goalPauseSeconds` | Pause zwischen zwei Zielen, in der „Geschafft!“ steht |
| `offline` | Offline-Ertrag: `rate` (Anteil, über 0 bis 1), `maxHours` (Obergrenze), `minAwaySeconds` (kürzere Pausen laufen als normales Spiel nach, statt Offline-Ertrag zu zahlen), `warmupSeconds` und `sampleSeconds` (wie lange die Spielregeln eine Kopie des Spielstands ohne Spieler einschwingen lassen und dann messen, siehe unten), `doublePriceShare` (Preis des Verdoppelns ohne Werbung als Anteil des Offline-Ertrags) |
| `locations[]` | Standorte in Reihenfolge, siehe „Standorte“: `id`, optional `priceFactor` und `arrivalFactor`; ab dem zweiten zusätzlich `moveCost` und optional `reveal` |
| `boost` | `factor` (Faktor auf die Verkaufspreise), `seconds` (Dauer, gezählt nur beim Spielen), `priceSeconds` (Kaufpreis: so viele Sekunden der Einnahmen der Automatik), `adsPerDay` (Boosts per Werbung pro Kalendertag), optional `reveal` (Bedingung, ab der das Angebot erscheint) |
| `simulation` | Einstellungen des Simulators, siehe unten |

**Effekte des Ausbaus** (gelten, sobald man das Teil mindestens einmal besitzt):

| Effekt | Wirkung |
| --- | --- |
| `panBags` | Säcke je Pfannen-Charge; der größte Wert zählt |
| `capacity` | Säcke je Fach im Wagen; der größte Wert zählt |
| `priceFactor` | multipliziert den Preis je Sack und je Espresso |
| `arrivalFactor` | multipliziert den Abstand zwischen zwei Gästen; unter 1 kommen sie öfter |
| `roastFactor` | multipliziert die Röstdauer aller Röster; unter 1 rösten sie schneller |
| `panAutomatic` | die Pfanne röstet und wirft von selbst aus, und zwar für die offenen Wünsche (siehe „Wünsche und Automatik“) |
| `followWishes` | Trommelröster lassen sich zusätzlich auf „auto“ stellen; der Kauf stellt alle darauf |
| `espresso` | ein Teil der Gäste bestellt Espresso, die Maschine brüht ihn (siehe „Espresso“) |
| `roaster` | jeder Kauf stellt einen weiteren Röster dieser Art auf (`roasters.<art>`) |

**Bedingungen** haben entweder `stat` oder `owned`, optional `min` (Standard 1):
- `{ "stat": "sales" }`: so viele Verkäufe. Statistiken: `taps` (Pfanne befüllt oder gerührt), `switches` (Trommelröster umgestellt), `brews` (Espressomaschine angetippt), `manualEjects`, `ejects`, `sales` (Säcke und Espresso), `espressos`, `lost`, `revenue`.
- `{ "owned": "helper" }`: so viele Stück dieses Ausbaus.

`validateTheme()` in `src/core/model.js` prüft das alles beim Start. Ein Fehler stoppt das Spiel mit einer Meldung, statt mit falschen Zahlen zu laufen.

## Wünsche und Automatik

- **Nur der Wunsch:** Ein Gast kauft nur einen Sack in dem Röstgrad, den er sich wünscht. Es gibt einen Preis je Sack.
- **Bedienen:** Der Verkäufer bedient einen Gast nach dem anderen. Dran ist der erste Gast in der Schlange, der an seinem Platz steht und dessen Röstgrad im Wagen liegt, auch wenn Gäste vor ihm noch warten.
- **Geduld:** Ab dem ersten Verkauf wartet ein Gast `guests.patienceSeconds` Sekunden. Kommt sein Röstgrad nicht, geht er und zählt als verloren, wie ein Gast, der vor einer vollen Schlange umkehrt. Vor dem ersten Verkauf läuft keine Geduld ab, damit man die ersten Chargen in Ruhe lernt.
- **Fächer im Wagen:** Der Wagen hat ein Fach je Röstgrad mit `capacity` Säcken. Ein volles Fach hält nur die Röster auf, die gerade diesen Röstgrad abladen wollen; die anderen Fächer bleiben frei. Ohne Fächer konnte ein Trommelröster, der lange auf einem Röstgrad stand, den ganzen Wagen füllen. Dann stand die Rösterei still, bis genug Gäste genau diesen Röstgrad wollten.
- **Trommelröster:** Jeder steht auf einem Röstgrad und röstet ihn. Antippen schaltet weiter: hell, mittel, dunkel und mit dem Röstprofil auch „auto“. Eine laufende Charge zielt dann auf den neuen Röstgrad; ist sie schon darüber hinaus, kommt sie sofort heraus.
- **Plan der Automatik** (`plan()`): Er legt fest, worauf jeder Röster hinarbeitet.
  - Zuerst decken der Wagen, die Chargen auf den Kühlblechen und die Trommelröster mit festem Röstgrad Wünsche ab.
  - Dann nehmen die Pfanne mit Helferin und die Trommelröster auf „auto“ je den ersten offenen Wunsch, den ihre Charge noch erreichen kann. Wer schon weiter geröstet hat, wählt zuerst. Jeder deckt so viele Wünsche dieses Röstgrads ab, wie seine Charge Säcke hat.
  - Ist nichts offen, füllen sie die Fächer auf: den Röstgrad, von dem im Wagen am wenigsten liegt, gemessen daran, wie oft er gewünscht wird.
  - Die Pfanne ohne Helferin bekommt den ersten Wunsch, der offen bleibt, bevorzugt einen, den die laufende Charge noch erreichen kann. Die Skala zeigt ihn dem Spieler an. Füllt die Helferin nur Fächer auf, zeigt die Skala keinen Wunsch.

## Espresso

- **Bestellungen:** Mit der Espressomaschine bestellt der Anteil `espresso.share` der Gäste einen Espresso statt eines Röstgrads. Die Sprechblase zeigt dann eine Tasse.
- **Maschine:** Sie brüht von selbst eine Tasse nach der anderen, je `espresso.brewSeconds` Sekunden, solange weniger als `espresso.cups` fertige Tassen neben ihr stehen. Jedes Antippen bringt `espresso.tapBrew` einer Tasse. Bei voller Ablage ruht sie, und Antippen bewirkt nichts.
- **Verkauf:** Ein Espresso-Gast kauft nur eine Tasse, für `espresso.basePrice` mal die Preisfaktoren (Café, Röstkurs, Standort, Boost). Bedient wird wie bei den Säcken ein Gast nach dem anderen, Geduld gilt genauso.
- **Röster:** Der Plan der Automatik kennt keinen Espresso; Röster rösten nur für Röstgrade.
- **Warum die Maschine schneller brüht, als bestellt wird:** Brüht sie langsamer, warten Espresso-Gäste in der Schlange und blockieren die Plätze; dann gehen auch Gäste verloren, die einen Sack wollten. Im Simulator verlor der gemütliche Spieler so 38 % der Gäste, als eine Tasse 6 Sekunden brauchte. Mit 3 Sekunden hält die Maschine im Schnitt mit, und Antippen hilft bei Andrang.

## Speicherstand und Offline-Ertrag

- **Speicherstand:** `serializeState()` schreibt Zeit, Geld, Zufallszahl, Ausbau, den Röstgrad jedes Trommelrösters (`drumLevels`), Säcke im Wagen, fertige Tassen an der Espressomaschine (`espressoCups`), Statistiken, Ziel und die nächste Sonderlieferung. `sanitizeState()` prüft einen geladenen Stand und gibt `null` zurück, wenn er nicht passt. Unbekannte Teile des Ausbaus und Röstgrade fallen weg, ebenso „auto“ ohne Röstprofil; Mengen werden auf das begrenzt, was das Thema zulässt (Käufe je Teil, Säcke je Fach, Zahl der Ziele). Gäste und laufende Chargen beginnen nach dem Laden neu.
- **Ältere Spielstände:** Ohne `drumLevels` stehen die Trommelröster auf `roast.defaultLevel`, mit Röstprofil auf „auto“. Ziele werden nach ihrer Nummer gespeichert; weil das Ziel „match“ weggefallen ist und „switch“ und „earn6“ dazugekommen sind, kann ein älterer Spielstand ein Ziel überspringen oder wiederholen.
- **Offline-Ertrag:** `automaticIncomePerMinute()` spielt eine Kopie des Spielstands ohne Eingaben, erst `offline.warmupSeconds`, dann `offline.sampleSeconds`, und misst die Einnahmen der zweiten Phase. `src/core/offline.js` zahlt davon `offline.rate` für die Zeit weg, höchstens `offline.maxHours` Stunden.
- **Spielstand bei Abwesenheit:** Er läuft in dieser Zeit nicht weiter; Gäste, Röster und Sonderlieferung stehen danach dort, wo sie waren.

## Standorte (Prestige)

- **Start:** Die Rösterei beginnt am ersten Standort (`locations[0]`).
- **Umzug:** `move()` zieht an den nächsten Standort, sobald dessen `reveal` erfüllt ist und das Geld `moveCost` erreicht.
  - Der Durchgang beginnt neu: Geld, Ausbau, Säcke, Gäste, Ziele und die Statistiken des Durchgangs bleiben zurück. Ein laufender Boost und die Boosts per Werbung des Tages bleiben.
  - Ziele mit `tutorial: true` werden übersprungen.
  - Das Geld geht ganz verloren, nicht nur `moveCost`; der Dialog sagt das.
- **Bonus:** Der neue Standort bleibt. Sein `priceFactor` multipliziert den gerundeten Verkaufspreis, sein `arrivalFactor` den Abstand zwischen zwei Gästen.
- **Szene:** Sie bekommt den Standort im Spielstand (`state.location`). Die Kaffeerösterei zeigt ab dem zweiten Standort das Hafenviertel am Abend.
- **Texte je Standort:** `locations.<id>.name`, ab dem zweiten zusätzlich `.move`, `.effect`, `.moveTitle`, `.moveBody`, `.banner` und `.goal`.

## Boost

- **Wirkung:** Solange er läuft, multipliziert `boost.factor` jeden Verkaufspreis. Damit steigt auch die Belohnung der Sonderlieferung, die sich nach den Einnahmen richtet; Zielbelohnungen bleiben gleich.
- **Uhr:** `advance()` zählt die Restzeit herunter. Zeit, die der Spieler nicht gesehen hat, rechnet `advanceUnseen()` nach: Das Spiel läuft weiter, der Boost wartet und verdoppelt nichts. Offline-Ertrag und Kaufpreis rechnen ohne Boost.
- **Per Werbung:** `startAdBoost(state, day)` mit dem Kalendertag des Geräts (`"YYYY-MM-DD"`), höchstens `boost.adsPerDay` am Tag.
- **Als Kauf:** `buyBoost()`. Der Preis (`boostPrice()`) sind `boost.priceSeconds` der Einnahmen der Automatik, gemessen an einer frischen Kopie mit demselben Ausbau. Er hängt also nur vom Ausbau ab.
- **Kein Stapeln:** Läuft ein Boost, scheitern beide Wege.
- **Speicherstand:** Restzeit und die Boosts per Werbung des Tages werden gespeichert. Spielstände ohne diese Felder laden mit „kein Boost“.

## Texte

- Kerntexte in `src/core/locales/` decken allgemeine Knöpfe und Meldungen ab, etwa Einstellungen, Neustart, „pro Minute“ und den Ausbau.
- **Das Thema bringt mit:**
  - den Titel
  - zu jedem Ausbau `items.<id>.name` und `.effect`
  - zu jedem Ziel `goals.<id>`
  - zu jedem Röstgrad `levels.<id>`
  - die Texte von Skala, Status, Übersicht, Einblendungen und Bannern
- **Platzhalter** wie `{value}` müssen in beiden Sprachen gleich sein. Das prüft ein Unit-Test.
- **Ziele mit Menge:** Bei `goals.<id>` setzt das Spiel `{value}` auf das `min` der Bedingung, etwa „Verdiene {value} mit Verkäufen.“ Die Zahl steht so nur in `theme.json`.
- **Fehlende Texte:** Fehlt ein Text, zeigt das Spiel den Schlüssel und meldet ihn in der Konsole. Damit schlägt auch der Browser-Test an.

## Balance-Simulator

`npm run sim` spielt das Thema mit zwei gescripteten Spielern und mehreren Seeds (`simulation.seeds`) bis `simulation.seconds`:
- **aktiv:** tippt dreimal pro Sekunde: auf die Espressomaschine, solange mehr Espresso-Gäste warten, als Tassen fertig sind, sonst auf die Pfanne (Rühren). Er wirft aus, wenn die Röstung den Wunsch auf der Skala erreicht, und stellt jeden Trommelröster vor jeder Charge auf den ersten offenen Wunsch.
- **gemütlich:** rührt nie und tippt die Espressomaschine nicht an, wirft nur von Hand aus, bis die Helferin das übernimmt, und schaut nur alle 30 Sekunden nach den Trommelröstern; dann stellt er jeden vor seiner nächsten Charge um.

Beide kaufen, was das aktuelle Ziel verlangt, tippen, was ein Ziel antippen lässt, danach kaufen sie alles, was sie sich leisten können, und tippen auf die Sonderlieferung. Trommelröster auf „auto“ lassen sie dort. Sobald sie umziehen können, ziehen sie um; Zeitpunkte danach heißen `2:<Meilenstein>` und zählen ab dem Umzug. Boosts und Verdoppeln nutzen sie nicht; das Tempo gilt also für Spieler ohne Werbung. Das sind Annahmen, keine Messungen echter Spieler.

**Ausgabe:**
- je Spieler der früheste und späteste Zeitpunkt über alle Seeds für den ersten Verkauf, jeden Ausbau und das Ende der Ziele
- die längste Wartezeit ohne Fortschritt
- **Leerlauf:** die längste Strecke am Stück (`longest idle`) und der Anteil an der Zeit (`idle share`), in denen Rösten nichts bringt. Gezählt wird in Abschnitten von 15 Sekunden: Mindestens die Hälfte der Zeit war der Wagen ganz voll oder ein Röster wartete auf Platz in seinem Fach, und kein Gast wartete auf einen Röstgrad, der nicht im Wagen lag, oder auf einen Espresso, der nicht fertig war. Nur solange noch etwas offen ist, also nicht nach dem letzten Kauf.
- **Verlorene Gäste** (`guests lost`): Anteil der Gäste, die vor einer vollen Schlange umkehren oder ohne ihren Röstgrad gehen. Er zeigt, ob sich Rühren lohnt: Der aktive Spieler sollte deutlich weniger Gäste verlieren als der gemütliche.
- was die Automatik am Ende ohne Spieler pro Minute einbringt (`auto per min`) und was das als Offline-Ertrag für die volle Obergrenze ergibt (`offline 8 h`)

**Harte Fehler** beenden mit Code 1:
- Geld wird ungültig oder negativ.
- Länger als `simulation.maxSecondsWithoutProgress` gibt es keinen Kauf, kein erreichtes Ziel und keinen Umzug, obwohl noch etwas offen ist. Das Sparen auf einen Umzug zählt als offen.
- Das Thema ist ungültig.

**Warnungen:**
- Zeitpunkte außerhalb von `simulation.targets` (je Spieler und Meilenstein `[frühestens, spätestens]` in Sekunden)
- Leerlauf länger als `simulation.maxIdleSeconds` am Stück

Der Unit-Test des Simulators verlangt für das Thema null Warnungen; eine Warnung lässt also auch `npm test` scheitern.

**Stand 02.10.2026 (strenge Wünsche, einstellbare Trommelröster, Espresso):**
- aktiv: Trommelröster nach 2:01 bis 2:10, Café nach 3:35 bis 3:53, Espressomaschine nach 8:02 bis 8:31, Röstkurs nach 12:00 bis 12:30, Umzug nach 15:21 bis 15:49; im zweiten Durchgang Café nach 2:02 bis 2:16, Röstkurs nach 6:07 bis 6:37
- gemütlich: Café nach 4:59 bis 5:40, Röstkurs nach 14:46 bis 15:33, Umzug nach 18:41 bis 19:53; im zweiten Durchgang Röstkurs nach 7:14 bis 8:03
- längste Wartezeit ohne Kauf, Ziel oder Umzug: 1:19 (aktiv), 1:37 (gemütlich)
- Leerlauf: höchstens 0:30 am Stück und 2 % der Zeit (aktiv), höchstens 0:15 beim gemütlichen Spieler
- verlorene Gäste: 6 % (aktiv), 21 % (gemütlich)
- keine Warnungen
- **Espresso:** 30 % der Gäste, eine Tasse alle 3 Sekunden, Preis 12 (mit Café 18, mit Röstkurs 23). Die Maschine gibt keinen Preisaufschlag von 40 % auf Säcke mehr, sondern lockt etwas mehr Gäste an (`arrivalFactor` 0,85). Ohne diese Gäste hatten die Röster nach der Maschine zu wenig zu tun: Leerlauf bis 1:00 am Stück und 11 % der Zeit beim aktiven Spieler.
- **Was sich mit den strengen Wünschen geändert hat:**
  - Preis je Sack 7,5 statt 5 (ohne Wunsch) und 8 (mit Wunsch). Gerundet sind das am Anfang 8, mit Café 11 und mit Röstkurs 15.
  - Spätere Teile kosten mehr: Lastenrad 1.100, Espressomaschine 1.600, Gasbrenner 2.200, Röstkurs 2.500, Umzug 5.800. Mit Röstprofil und aufgefüllten Fächern trifft die Automatik die Wünsche fast immer; ohne die höheren Preise kam der Umzug für den aktiven Spieler schon nach etwa 13 bis 14 Minuten.
  - Die Ziele für Einnahmen liegen wieder in der Mitte zwischen zwei Käufen (1.300, 2.450, 3.900, 5.600, 7.800 und neu 9.200), damit keine Pause länger als zwei Minuten wird.
- **Warum diese Reihenfolge:** Vorher kamen Helferin und Trommelröster direkt hintereinander. Ab etwa Minute 2 konnten Pfanne und Trommelröster schon ohne Rühren rund 31 Säcke pro Minute rösten, es kamen aber nur etwa 21 Gäste (geschätzt aus den Röstzeiten und Ankünften). Der Wagen stand voll, die Röster standen 36 bis 68 % der Zeit still, und Rühren brachte bis zum Café nichts (Leerlauf bis 2:30 am Stück, 36 % der Zeit). Jetzt wechseln sich mehr Gäste und mehr Röster ab:
  - Helferin, dann der Kundenstopper (mehr Gäste): Gäste warten, Rühren lohnt sich.
  - Trommelröster (jetzt 12 statt 10 Sekunden bis zur dunkelsten Röstung), dann Röstprofil und Café: Nachfrage und Röster etwa gleich.
  - zweiter Trommelröster, dann das Lastenrad (mehr Gäste, mehr Platz): Danach warten wieder Gäste, bis der Gasbrenner die Röster beschleunigt. Die Espressomaschine und der Röstkurs heben dazwischen die Preise.
  - Die Ziele für Einnahmen liegen jeweils etwa in der Mitte zwischen zwei Käufen, damit keine Pause länger als zwei Minuten wird. Im Hafenviertel gelten dieselben Schwellen; mit den doppelten Preisen erreicht man sie schneller, der zweite Durchgang ist darum kürzer.
- Automatik am Ende des simulierten zweiten Durchgangs: etwa 1.780 bis 2.380 pro Minute, also 430.000 bis 570.000 für 8 Stunden offline.
