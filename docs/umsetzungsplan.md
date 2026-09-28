# Umsetzungsplan Idle-Spiel „Kaffeerösterei“ (Thema 1)

Der Nutzer hat den Plan am 28.09.2026 freigegeben. Ergänzungen, die nach der Freigabe dazukamen, sind mit *(Ergänzung)* markiert. Sie stammen aus den CrazyGames-Anforderungen, die ab Schritt 1 lesbar waren.

## Kontext

Ziel ist ein Browser-Idle-Spiel aus statischen Dateien (HTML, CSS, JS-Module), das zuerst auf CrazyGames erscheint und später auf einer eigenen Domain. Die Umsetzung läuft in 6 Schritten, jeder mit eigenem Branch und eigenem PR, in dieser Reihenfolge. Projektregeln: [CLAUDE.md](../CLAUDE.md).

**Cloud-Umgebung (Stand 28.09.2026)**
- Node 22 und npm sind vorhanden.
- Vorinstalliert ist nur Chromium; die Browser-Revision passt zu `@playwright/test` 1.56.1.
- Firefox und WebKit lassen sich nachinstallieren, wenn das Netz es erlaubt (am 28.09.2026 ging es):

  ```
  npx playwright install firefox webkit
  npx playwright install-deps firefox webkit
  ```
- Der Netzzugang war zuerst stark eingeschränkt. Der Nutzer hat ihn am 28.09.2026 erweitert; danach waren `docs.crazygames.com`, `sdk.crazygames.com`, `www.gesetze-im-internet.de` und `developers.google.com` erreichbar.
- Das Repo ist öffentlich.

## CrazyGames-Anforderungen *(Ergänzung)*

Direkt gelesen am 28.09.2026. Quellen:
- https://docs.crazygames.com/requirements/intro/
- https://docs.crazygames.com/requirements/technical/
- https://docs.crazygames.com/requirements/gameplay/
- https://docs.crazygames.com/requirements/quality/

Hier steht nur, was für unsere Schritte wichtig ist.

**Größe und Dateien (Basic Launch)**
- Startdownload höchstens 50 MB, für die mobile Startseite höchstens 20 MB.
- Insgesamt höchstens 250 MB (ohne SDK 50 MB) und höchstens 1500 Dateien.
- Nur relative Pfade.

**Browser und Geräte**
- Chrome und Edge müssen laufen. Läuft ein Spiel in Safari schlecht, wird es dort abgeschaltet.
- Auf einem Chromebook mit 4 GB RAM muss es flüssig laufen.
- Maus, Tastatur und, falls mobil unterstützt, Touch.
- Auf dem Desktop im Querformat spielbar; Hochformat ist erlaubt.
- Mobil wird für `body` die CSS-Regel `user-select: none` empfohlen, gegen Lupe und Textauswahl bei Doppeltipp oder langem Drücken.
- In der CrazyGames-App sind die Safe Areas zu beachten.

**Lesbarkeit**

Texte und Bilder müssen bei devicePixelRatio 1 in diesen iframe-Größen lesbar sein:

| Einsatz | Größen |
| --- | --- |
| Desktop, kein Vollbild | 907×510, 1216×684, 1077×606, 821×462 |
| Desktop, Vollbild | 1366×768, 1920×1080, 1536×864, 1280×720 |
| Mobil | 800×450 |
| Tablet | 1080×607 |

**Sprache**
- Englisch ist Pflicht, Übersetzungen müssen gut sein.
- Die Sprache soll aus der Locale-Angabe des SDK kommen (System Info), sonst Englisch.

**Inhalt**
- Namen, Grafiken und Inhalte müssen originell sein.
- Kein eigener Vollbild-Knopf.
- Keine Werbung für andere Spiele oder Plattformen. Ausnahmen sind unter anderem Datenschutz- und AGB-Hinweise. Community-Links sind nur im Menü erlaubt und dürfen nicht zu einer spielbaren Webversion führen.
- PEGI 12, Publikum ab 13 Jahren.

**Basic Launch**
- Das SDK ist optional. Wer es einbindet, muss das Ereignis „Gameplay start“ auslösen.
- Werbung ist im Basic Launch nicht erlaubt und wird selbst mit SDK abgeschaltet.

**Full Launch**
- Gameplay-start- und -stop-Ereignisse.
- Speicherstand über das Data-Modul, falls zutreffend.
- Anzeigen nur über das SDK, nach deren Richtlinien; das Spiel muss auch mit AdBlock laufen.
- Neue Spieler landen sofort im Spiel, höchstens 1 Klick davor.

**Einwilligung**
- Nur nötig, wenn das Spiel über die SDK-Ereignisse hinaus personenbezogene Daten erhebt. Wir erheben keine.

**Qualitätsleitfaden** (empfohlen, keine Pflicht)
- Einstieg im Spiel selbst und überspringbar.
- Knöpfe nicht so groß, dass sie zu Werbung drängen, und ohne künstliche Verzögerung.
- Ein eindeutiger Name statt eines allgemeinen Begriffs.

## Arbeitsweise (alle Schritte)

- **Branches:** Schritt 1 auf `claude/keen-bohr-mkfwny`, die Schritte 2–6 auf `claude/schritt-<N>-<thema>`. Der Nutzer hat beides freigegeben.
- **Ablauf:** Die Schritte 1 und 2 begannen jeweils nach dem Merge des vorigen PRs frisch von `main`. Ab Schritt 3a gilt „Gestapelte PRs“ (unten).
- **Vor jedem PR laufen:**
  - `npm test`
  - `npm run sim` (ab Schritt 2)
  - `npm run build`
  - `npm run check:size`
  - `npm run test:browser`

  `npm run check` führt alles nacheinander aus. Die CI wiederholt die Prüfungen in Chromium, Firefox und WebKit.
- **PR-Text auf Deutsch** mit drei Abschnitten: Was geändert wurde / Wie geprüft (mit Ergebnis) / Was nicht geprüft werden konnte.
- **Größe:** Wird ein Schritt zu groß, wird er in zwei PRs geteilt (z. B. 3a/3b), vorher angekündigt. Schritt 3 ist so geteilt: 3a Oberfläche, 3b Speicherstand und Offline-Ertrag.
- **Gestapelte PRs** *(Änderung vom 28.09.2026)*: Der Nutzer hat am Abend gebeten, ohne Rückfragen so viel wie möglich zu schaffen. Ab Schritt 3a baut darum jeder Branch auf dem vorigen auf, und der PR zielt auf den vorigen Branch, sodass er nur seinen eigenen Diff zeigt. Gemergt wird in der Reihenfolge der Schritte. Nach jedem Merge wird der nächste Branch auf den neuen Stand von `main` gebracht, und sein PR zielt dann auf `main`.
- **Abhängigkeiten:** keine zur Laufzeit. Die einzige Entwicklungs-Abhängigkeit ist `@playwright/test`, fest auf 1.56.1. Unit-Tests laufen mit `node --test`.
- Code und Kommentare auf Englisch, Doku auf Deutsch. Nichts Fremdes, keine IDs oder Schlüssel im Repo.

---

## Schritt 1 – Gerüst

**Branch:** `claude/keen-bohr-mkfwny`

**Inhalt**
- Ordnerstruktur nach CLAUDE.md, leere Ordner mit `.gitkeep`.
- `package.json` mit den Skripten, `.gitignore` und `README.md`.
- `index.html` und `src/main.js` als Platzhalterseite. `src/config.js` enthält die Einstellungen für die Entwicklung.
- `config/targets.json`:
  - Ziele `crazygames` und `web`.
  - `runtime` landet als `src/config.js` im Paket.
  - `allowedUrls` ist die Ausnahmeliste der URL-Prüfung.
- `tools/build.mjs`: ein Paket pro Ziel in `dist/<ziel>/`, ohne Bundler.
- `tools/serve.mjs`: statischer Server mit korrekten MIME-Typen.
- `tools/check-size.mjs`: Grenze 2.000.000 Bytes, dazu die Suche nach externen URLs.
- Unit-Tests (Node-Testrunner) und ein Browser-Test (Playwright). Der Browser-Test prüft: Laden unter einem Unterpfad, keine Konsolenfehler, keine Anfrage an fremde Domains.
- `.github/workflows/ci.yml`: Alle Prüfungen in drei Browsern, die Pakete als Artefakte.
- Dieser Plan und eine Verweiszeile in CLAUDE.md.

**Prüfung**
- Unit-Tests für Build, Größen-Check (auch mit künstlich kleinem Limit), URL-Suche und Server.
- Browser-Test.
- CI-Lauf.

**Nicht prüfbar**
- Ob CrazyGames das Paket annimmt; das Hochladen ist nicht Aufgabe von Claude.
- Einen Balance-Simulator gibt es in diesem Schritt noch nicht.

---

## Schritt 2 – Wirtschaftskern und Balance-Simulator

**Branch:** `claude/schritt-2-wirtschaftskern`

**Inhalt**
- `src/core/economy.js` besteht aus reinen Funktionen: ohne DOM, ohne Zufall, die Zeit kommt als Parameter herein.
  - Währung und Klick-Ertrag.
  - Erzeuger: Kosten = Basis × Wachstum^Anzahl. Mehrfachkauf als geometrische Summe, dazu „max kaufbar“.
  - Produktion pro Sekunde.
  - Upgrades, nur die Arten, die Thema 1 braucht: Multiplikator für einen Erzeuger, globaler Multiplikator, Klick-Multiplikator.
  - Erfolge: nur die Prüfung der Bedingungen. Die Anzeige kommt in Schritt 3, die Inhalte in Schritt 5.
  - Prestige: Punkte aus dem Ertrag des Durchgangs, Bonus je Punkt, Zurücksetzen.
- Zahlen sind normale JavaScript-`Number` (bis etwa 1e308). Der Simulator prüft, dass wir weit darunter bleiben. Reicht das nicht, wird der Nutzer nach einer Lösung für große Zahlen gefragt.
- Das `theme.json`-Format sowie `themes/kaffeeroesterei/theme.json` mit vorläufigen Werten und neutralen IDs. Die echten Inhalte kommen in Schritt 5.
- `tools/simulate.mjs` spielt mit fester Strategie: Es kauft jeweils, was sich am schnellsten bezahlt macht. Dabei laufen zwei Szenarien, „aktiv mit Klicks“ und „nur idle“.
  - Ausgabe: erster Kauf je Erzeuger, erstes Prestige, längste Wartezeit, größte Zahl.
  - Harter Fehler: NaN oder Unendlich, Stillstand, eine Zahl über 1e300.
  - Zielwerte führen nur zu Warnungen.
- **Vorschlag Zielwerte** (Annahme ohne Datengrundlage, der Nutzer legt sie fest):
  - erster Erzeuger nach höchstens 15 s
  - im ersten Durchgang nie länger als 5 min ohne sinnvollen Kauf
  - erstes Prestige nach etwa 45–60 min aktivem Spiel
  - zweiter Durchgang merklich schneller

**Prüfung**
- Die Unit-Tests nutzen ein kleines Test-Thema in `tests/fixtures/`:
  - Kostenformeln gegen Handrechnung
  - Mehrfachkauf ergibt die Summe der Einzelkäufe
  - „max kaufbar“ an Grenzwerten
  - Multiplikatoren
  - Prestige
  - Erfolge
  - Fehlkäufe ändern nichts
  - Zeitschritt 0 oder negativ
- Die Ausgabe des Simulators steht im PR.

**Nicht prüfbar**
- Ob sich das Tempo gut anfühlt: Der Simulator folgt einer festen Strategie.
- Die Werte bleiben bis Schritt 5 vorläufig.

---

## Schritt 3 – Oberfläche (Handy und Desktop), Speicherstand, Offline-Ertrag

**Branches:** `claude/schritt-3a-oberflaeche` (3a) und `claude/schritt-3b-speicherstand` (3b)

**Inhalt**
- Oberfläche in `src/core/ui/` mit reinem DOM:
  - Kopfzeile mit Währung und Ertrag pro Sekunde
  - Klickfläche
  - Erzeugerliste mit Kauf x1, x10 oder max
  - Bereiche für Upgrades, Erfolge und Prestige
  - Einstellungen: Sprache, Fortschritt zurücksetzen (mit Rückfrage)
- Handy zuerst, auf dem Desktop mehrspaltig.
  - Knöpfe mindestens 44 px, keine Bedienung nur per Hover, `touch-action: manipulation`.
  - Systemschrift.
- *(Ergänzung)* Aus den CrazyGames-Anforderungen:
  - Das Spiel startet direkt im Spiel, ohne Startbildschirm.
  - `user-select: none` am `body` und Safe-Area-Abstände.
  - Kein Vollbild-Knopf.
  - Im CrazyGames-Paket keine Links nach außen.
- Oberflächentexte in EN und DE unter `src/core/locales/`. Bis Schritt 5 zeigt die Oberfläche die IDs statt Namen aus dem Thema.
- *(Ergänzung)* Sprachwahl je Ziel:
  - `crazygames`: gespeicherte Wahl, sonst die Locale des SDK (erst ab Full Launch), sonst Englisch.
  - `web`: gespeicherte Wahl, sonst Browsersprache, sonst Englisch.
- Zahlenformat je Sprache. Das englische „billion“ ist die deutsche „Milliarde“. Sehr große Zahlen erscheinen in wissenschaftlicher Schreibweise.
- `src/core/save.js`:
  - localStorage mit Versionsnummer und Migration, jeder Zugriff in try/catch.
  - Ein kaputter Stand führt zu einem neuen Spiel.
  - Ohne Speicher erscheint ein Hinweis, das Spiel läuft weiter.
  - Automatisches Speichern etwa alle 10 s und beim Verbergen oder Verlassen des Tabs.
  - *(Ergänzung)* Der Speicherzugriff läuft über eine kleine Schnittstelle, damit sich beim Full Launch das Data-Modul von CrazyGames einsetzen lässt.
- `src/core/offline.js`:
  - Offline-Ertrag mit Obergrenze (Vorschlag: 8 Std.), eventuell mit reduzierter Rate.
  - Eine zurückgestellte Uhr ergibt 0.
  - Dialog „Während du weg warst …“.
  - Die Zeit in einem Hintergrund-Tab wird nachgerechnet.

**Prüfung**
- Unit-Tests: Zahlenformat, Speichern und Laden, Migration, kaputter Stand, Speicher, der Fehler wirft, Offline-Berechnung.
- Browser-Test:
  - Handy 390×844 mit Touch und Desktop 1280×800.
  - *(Ergänzung)* Zusätzlich die kleinen CrazyGames-Größen 800×450 und 821×462.
  - klicken und kaufen, Produktion über die Zeit (Playwright-Uhr)
  - Neuladen behält den Stand, Offline-Dialog nach vorgespulter Zeit
  - gesperrter Speicher
  - keine waagerechte Scrollleiste, Knopfgrößen, Sprachwechsel
  - keine Konsolenfehler, keine fremden Anfragen
- Screenshots für Handy und Desktop gehen an den Nutzer.

**Nicht prüfbar**
- Echte Geräte, Touch-Gefühl, Leistung auf schwachen Handys und Chromebooks.
- Das Speicherverhalten von Safari auf iOS.
- Geschmack.

---

## Schritt 4 – Werbe-Adapter

**Branch:** `claude/schritt-4-werbe-adapter`

**Vorher:** die aktuelle SDK-Doku lesen (https://docs.crazygames.com/sdk/intro/), *(Ergänzung)* dazu die Werbe-Anforderungen von CrazyGames, damit die Schnittstelle passt. Echte SDK-Aufrufe entstehen in diesem Schritt noch nicht.

**Inhalt**
- `src/ads/index.js` mit der Schnittstelle:
  - `init()`
  - `canShowRewarded()`
  - `showRewarded()` → `Promise<boolean>`
  - `showInterstitial()` → `Promise`, wirft nie

  Der Build packt nur den Adapter des jeweiligen Ziels ins Paket.
- `src/ads/none.js`: Mit `simulate` spielt er eine Anzeige vor (für Entwicklung und Tests), sonst meldet er „keine Anzeige verfügbar“.
- `src/ads/crazygames.js` als Platzhalter: kein SDK, keine Anfrage, „keine Anzeige verfügbar“. Das passt zum Basic Launch, in dem Werbung ohnehin nicht erlaubt ist.
- Anbindung ans Spiel. Belohnungen gibt es nur innerhalb des Spiels.
  - Ein Knopf „Werbung ansehen: 10 min doppelte Einnahmen“, nur auf Klick. Vorschlag: nur eine Verstärkung gleichzeitig, sie übersteht ein Neuladen.
  - „Offline-Ertrag verdoppeln“ im Offline-Dialog.
  - Eine Zwischenanzeige nur nach einem Prestige, mit Mindestabstand (Vorschlag: 5 min).
  - Fehler oder Abbruch bringen keine Belohnung; ein Doppelklick bringt keine doppelte Belohnung.
  - *(Ergänzung)* Werbe-Knöpfe sind nicht übergroß und haben keine künstliche Verzögerung.
- Ziel-Konfiguration: `crazygames` nutzt den Platzhalter. `web` nutzt `none` ohne Simulation, bis `adsense-h5` kommt.

**Prüfung**
- Unit-Tests mit einem Test-Adapter:
  - ohne Klick keine Anzeige
  - Belohnung nur bei Erfolg
  - die Verstärkung läuft richtig ab
  - Zwischenanzeige nur nach Prestige und nicht öfter als erlaubt
- Browser-Test mit simulierten Anzeigen.
- In beiden Paketen: Belohnungs-Knöpfe ausgeblendet, keine fremden Anfragen, nur der passende Adapter im Paket.

**Nicht prüfbar**
- Das echte SDK, echte Anzeigen, die Abnahme durch CrazyGames.
- Die Developer-Terms sind nicht gelesen.

---

## Schritt 5 – Inhalte Thema 1: Kaffeerösterei

**Branch:** `claude/schritt-5-thema-kaffee`

**Inhalt**
- Die endgültige `theme.json`:
  - etwa 8–10 Erzeuger mit eigenen Namen aus allgemeinen Begriffen
  - Upgrades, Erfolge und der Begriff für Prestige
  - Balancing mit dem Simulator
- Texte `locales/en.json` und `de.json`. Für den Spieltitel gibt es Vorschläge; *(Ergänzung)* er soll eindeutig sein und kein allgemeiner Begriff. Die Entscheidung trifft der Nutzer.
- Eigene SVG-Grafiken, von Hand als Code geschrieben, nicht kindlich gestaltet.
- Die Farben des Themas als CSS-Variablen im Themenordner.

**Prüfung**
- Die Texte sind in beiden Sprachen vollständig, und die Platzhalter stimmen überein.
- SVG-Regeln: `viewBox`, kein Skript, keine externen Verweise, keine Rasterbilder, geringe Größe.
- Simulator, Browser-Test, Screenshots, Größen-Check.

**Nicht prüfbar**
- Marken- und Namensrecht (keine Markenrecherche möglich).
- Muttersprachliche Qualität der Texte.
- Ob CrazyGames das Spiel als originell genug ansieht, und die PEGI-Einstufung.
- Wie die Grafiken wirken.

---

## Schritt 6 – Entwürfe für die eigene Seite

**Branch:** `claude/schritt-6-seitenentwuerfe`

**Inhalt**
- Markdown-Entwürfe in `docs/entwuerfe/`: Anleitung (DE und EN), Über uns (DE und EN), Datenschutz (DE), Impressum (DE). In `dist/web` kommen sie noch nicht.
- Persönliche Angaben nur als Platzhalter `[…]`, weil das Repo öffentlich ist.
- Datenschutz mit Abschnitten zu:
  - Hosting (Cloudflare Pages)
  - Speicherstand im Browser
  - AdSense H5 Games Ads
  - dem Einwilligungstool (Anbieter noch offen)
- Die offenen Punkte stehen gesammelt in `docs/entwuerfe/README.md`; unsichere Aussagen sind in den Dateien als Hinweis markiert. *(Umgesetzt so statt einer Liste am Anfang jeder Datei.)*

**Prüfung**
- Vollständigkeit gegen eine Liste der Pflichtangaben, soweit sie sich aus erreichbaren Quellen belegen lassen.
- Platzhalter und Querverweise sind vollständig; die Anleitung passt zum Spiel.

**Nicht prüfbar**
- Rechtliche Richtigkeit: Das ist keine Rechtsberatung, der Nutzer prüft.
- Die tatsächlichen Datenflüsse, denn noch ist nichts eingerichtet.

---

## Nicht Teil dieses Plans (spätere eigene Schritte)

- Echte CrazyGames-SDK-Anbindung (Full Launch) und der `adsense-h5`-Adapter.
- Die Seiten in `dist/web` einbauen, Deployment und Domain.
- Cloud-Speicherstand, Export und Import des Spielstands, Ton.
- Analyse- und Tracking-Werkzeuge: keine.
- Konten, Einreichung, AdSense-Bewerbung (siehe CLAUDE.md).

## Nach Schritt 6: Durchsicht *(28./29.09.2026)*

- Nach Schritt 6 wurde der ganze Stapel noch einmal durchgesehen: Spielkern, Oberfläche und Texte, Werkzeuge und Tests, Doku.
- Fehler eines Schritts sind in dessen Branch behoben; der PR des Schritts nennt sie unter „Nachtrag“.
- Neues kommt als eigene, kleine PRs oben auf den Stapel:
  - `claude/durchsicht-doku`: Doku-Korrekturen und die nachgelesenen CrazyGames-Anforderungen (alle Fenstergrößen, Basic Launch, Einreichung).
  - `claude/speicherstand-absichern`: mehrere Tabs, Spielstand einer neueren Version, fehlgeschlagenes Speichern.

## Entscheidungen (freigegeben am 28.09.2026)

1. **Merge-Ablauf:** in der Reihenfolge der Schritte; ab 3a als gestapelte PRs (siehe Arbeitsweise).
2. **GitHub Actions (CI):** ja.
3. **Netzwerk:** Der Nutzer hat den Zugang für die CrazyGames-Doku freigegeben.
4. **Plan im Repo:** ja, dazu eine Verweiszeile in CLAUDE.md.
5. **Lizenzdatei:** keine, solange der Nutzer keine wünscht. Das Repo ist öffentlich.
6. **Zielwerte** (Balance, Offline-Grenze, Anzeigen-Abstand) werden in den Schritten 2, 3b, 4 und 5 festgelegt.
