# Themenformat und Balancing

Das beschreibt `themes/<name>/theme.json`, die Formeln des Wirtschaftskerns (`src/core/economy.js`) und den Balance-Simulator (`tools/simulate.mjs`). Stand: Schritt 2. Die Werte in `themes/kaffeeroesterei/theme.json` sind vorläufig und tragen neutrale IDs (`g1` … `g8`); die echten Inhalte kommen in Schritt 5.

## theme.json

| Feld | Bedeutung |
| --- | --- |
| `id` | Name des Themenordners |
| `click.base` | Ertrag pro Klick ohne Boni |
| `generators[]` | Erzeuger: `id`, `baseCost` (Preis des ersten Stücks), `costGrowth` (Preisfaktor je gekauftem Stück, größer als 1), `baseRate` (Ertrag pro Sekunde je Stück) |
| `upgrades[]` | Upgrades: `id`, `cost`, `effect`, optional `unlock` (eine Bedingung; ohne sie ist das Upgrade sofort verfügbar) |
| `achievements[]` | Erfolge: `id`, `condition` |
| `prestige` | `threshold`, `exponent` (größer als 0, höchstens 1), `bonusPerPoint` |
| `offline` | `maxHours` (Obergrenze der Abwesenheit), `rate` (Anteil der normalen Produktion, größer als 0, höchstens 1) |

**Effekte** (`effect.factor` muss größer als 1 sein):

| `effect.type` | Wirkung |
| --- | --- |
| `generatorMultiplier` | multipliziert die Produktion eines Erzeugers (`effect.generator`) |
| `globalMultiplier` | multipliziert die gesamte Produktion, nicht die Klicks |
| `clickMultiplier` | multipliziert den Ertrag pro Klick |

**Bedingungen** haben immer einen `type` und einen `value`:

| `type` | erfüllt, wenn … |
| --- | --- |
| `owned` | mindestens `value` Stück von `generator` im aktuellen Durchgang |
| `runEarned` | seit dem letzten Prestige mindestens `value` verdient |
| `lifetimeEarned` | insgesamt mindestens `value` verdient |
| `clicks` | insgesamt mindestens `value` Klicks |
| `prestiges` | mindestens `value` Prestiges |

**IDs** bestehen nur aus Kleinbuchstaben, Ziffern und Unterstrich und sind über alle Listen hinweg eindeutig. Sie werden später zu Textschlüsseln. Fehlerhafte Daten lehnt `createEconomy` mit einer Fehlermeldung ab.

## Formeln

- **Preis des nächsten Stücks:** `baseCost × costGrowth ^ Anzahl`
- **Preis für k Stück:** Summe der nächsten k Preise (geometrische Reihe). „Max kaufbar“ rechnet mit der geschlossenen Formel und korrigiert Rundungsfehler exakt.
- **Produktion pro Sekunde:** Σ (Anzahl × `baseRate` × Erzeuger-Multiplikatoren) × globale Multiplikatoren × Prestige-Multiplikator
- **Klick:** `click.base` × Klick-Multiplikatoren × Prestige-Multiplikator
- **Prestige-Multiplikator:** `1 + Punkte × bonusPerPoint`
- **Prestige-Punkte:** `⌊(Ertrag des Durchgangs / threshold) ^ exponent⌋`
- **Prestige setzt zurück:** Währung, Ertrag des Durchgangs, Erzeuger und Upgrades.
- **Prestige behält:** Gesamtertrag, Klicks, Prestige-Punkte, Zahl der Prestiges und Erfolge.
- **Erfolge** haben in diesem Schritt nur Bedingungen und keinen Bonus.
- **Offline-Ertrag:** Produktion pro Sekunde × Abwesenheit (höchstens `maxHours`) × `rate`. Als Abwesenheit zählt jede Lücke von mehr als 60 Sekunden ohne Aktualisierung: geschlossenes Spiel, verborgener Tab oder schlafendes Gerät. Kürzere Lücken zählen voll.
- **Zahlen** sind normale JavaScript-Zahlen (bis etwa 1e308). Der Simulator prüft, dass sie unter 1e300 bleiben.

## Balance-Simulator

`npm run sim` spielt das Thema mit einer festen Strategie und gibt einen Bericht aus.

**Strategie:** Der simulierte Spieler kauft immer ein Stück von dem, was sich am schnellsten bezahlt macht. Dabei zählen die Wartezeit, bis er es sich leisten kann, und der Preis geteilt durch den zusätzlichen Ertrag pro Sekunde.

**Szenarien**
- „active“: 3 Klicks pro Sekunde. Das ist eine Annahme.
- „idle“: Er klickt nur, bis etwas produziert.

Jedes Szenario läuft zwei Durchgänge. Dazu kommt ein Dauerlauf über 30 Tage im Szenario „idle“, um die Größe der Zahlen zu prüfen.

**Prestige:** Der simulierte Spieler setzt zurück, sobald die neuen Punkte den Prestige-Multiplikator mindestens verdoppeln. Kann er 24 Stunden lang nichts kaufen, macht er ein Prestige, sofern es mindestens einen Punkt bringt.

**Harte Fehler** (Exit-Code 1):
- ungültige Zahlen (NaN, unendlich oder negativ)
- Stillstand: 24 Stunden lang ist nichts kaufbar, und ein Prestige ist nicht möglich
- eine Zahl über 1e300

**Zielwerte** (nur Warnungen, Annahmen aus dem Umsetzungsplan, gelten für „active“):
- erster Erzeuger nach höchstens 15 s
- im ersten Durchgang höchstens 5 min Wartezeit zwischen zwei Käufen
- erstes lohnendes Prestige nach 45–60 min
- der zweite Durchgang erreicht das Niveau des ersten mindestens 1,5-mal so schnell

**Grenzen:** Der Simulator folgt einer festen Strategie; echte Spieler kaufen anders, klicken unterschiedlich viel und machen Pausen. Ob das Spiel Spaß macht, kann er nicht beurteilen.
