# Prototyp: die ersten fünf Minuten

Stand: 29.09.2026. Dieser Prototyp zeigt die neue Richtung für Thema 1 nach der Rückmeldung „sieht schlecht aus, nur ein Knopf, langweilig“ und nach der Recherche zu vergleichbaren Spielen. Er ist bewusst vom eigentlichen Spiel getrennt: Er nutzt nichts aus `src/` und kommt in keines der Pakete unter `dist/`.

## Starten

```
npm run dev
```

Dann im Browser `http://127.0.0.1:8080/prototype/` öffnen. Vom Handy im selben WLAN geht es mit `npm run dev -- --host 0.0.0.0` und der Adresse des Rechners (siehe README im Hauptordner).

Der Prototyp speichert nichts. Neu laden oder der Knopf ↺ beginnt von vorn.

## Was neu ist

- **Die Rösterei ist zu sehen.** Links liegt der Röstraum mit Pfanne, später Helferin und Trommelröstern, rechts die Straße mit Kaffeewagen, Gästen und später dem Café. Jeder Kauf verändert das Bild.
- **Die Röstcharge ist die Kernmechanik.**
  - Die Bohnen werden sichtbar von grün über braun bis fast schwarz.
  - Beim ersten Crack knackt es hörbar, ab dann kannst du auswerfen.
  - Jeder Gast wünscht sich einen Röstgrad (hell, mittel, dunkel), zu sehen an der Sprechblase: Farbe der Bohne und 1 bis 3 Punkte.
  - Triffst du den Wunsch, gibt es 50 % mehr. Verfehlst du ihn, gibt es den normalen Preis, verloren geht nie etwas.
  - Rühren, also Tippen, röstet schneller.
- **Kette mit Engpass.** Geröstete Säcke kommen in den Wagen, Gäste kaufen sie. Ist der Wagen voll, warten die Röster. Ist die Schlange voll, gehen Gäste wieder. Beides zeigt das Spiel an.
- **Automatik.** Die Helferin röstet von selbst und wirft bei „mittel“ aus. Trommelröster laufen allein. Das Röstprofil lässt die Maschinen rösten, was die Gäste wünschen.
- **Zielleiste statt Einführung.** Sie zeigt immer den nächsten Schritt, eine Hand zeigt, wohin man tippen soll.
- **Sonderlieferung.** Ab etwa 2,5 Minuten kommt ab und zu ein Lastenrad. Antippen bringt einen Bonus, verpassen kostet nichts.
- **Ton.** Alle Geräusche werden im Browser erzeugt (Web Audio), es gibt keine Tondateien. Oben rechts lässt sich der Ton abschalten.

## Steuerung

- Tippen oder Klicken auf die Pfanne, oder der Knopf „Rösten/Rühren“, oder die Leertaste.
- „Auswerfen“, oder die Taste E.
- Tippen auf einen Trommelröster lässt ihn etwas schneller rösten.

## Tempo laut Simulation

Die Werte stammen aus `tests/unit/prototype.test.js` mit einem gescripteten Spieler, nicht von echten Spielern:

| | aktiv (rührt 3× pro Sekunde) | gemütlich (rührt nie) |
| --- | --- | --- |
| erster Verkauf | nach etwa 5 s | nach etwa 9 s |
| Helferin | nach etwa 40 s | nach etwa 1 Minute |
| erster Trommelröster | nach etwa 1:40 | nach etwa 2:30 |
| Café | nach etwa 4:15 | nach etwa 5:20 |

## Was fehlt (bewusst)

- Speicherstand, Offline-Ertrag, Prestige, Werbung, Erfolge: Das gibt es im eigentlichen Spiel schon oder es kommt beim Einbau.
- Inhalte nach dem Café. Nach dem letzten Ziel meldet sich der Prototyp und sagt, dass nichts Neues mehr kommt.
- Der Titel. „Roast & Rise“ ist als Name schon von einem iOS-Spiel belegt (siehe Recherche), darum steht hier nur „Rösterei – Prototyp“.

## Worauf es beim Testen ankommt

1. Gefällt dir die Optik als Richtung (Stil, Farben, Figuren)?
2. Macht das Rösten Spaß: Crack abwarten, im richtigen Moment auswerfen, Wünsche treffen?
3. Ist in jedem Moment klar, was als Nächstes zu tun ist?
4. Wird es irgendwo zäh oder zu schnell?
5. Stört etwas, zum Beispiel ein Ton, eine Animation oder ein Text?

## Code

| Datei | Inhalt |
| --- | --- |
| `model.js` | Spielregeln ohne DOM: Röstcharge, Wagen, Gäste, Käufe, Ziele, Sonderlieferung |
| `scene.js` | Die Szene als SVG, alle Grafiken als Code |
| `audio.js` | Erzeugte Töne |
| `texts.js` | Texte Deutsch und Englisch |
| `main.js` | Verbindet alles, Eingabe, Anzeige |
| `style.css` | Layout für Quer- und Hochformat |

Tests: `tests/unit/prototype.test.js` (Regeln und Tempo), `tests/browser/prototype.spec.js` (Ablauf und Layout im Browser).
