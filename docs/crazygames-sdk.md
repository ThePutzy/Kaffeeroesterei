# CrazyGames: Anforderungen und SDK (Notizen)

Direkt gelesen am 28.09.2026 auf docs.crazygames.com. Vor der Anbindung des SDK (Full Launch) erneut lesen; die Doku kann sich ändern.

Quellen:
- https://docs.crazygames.com/requirements/intro/
- https://docs.crazygames.com/requirements/technical/
- https://docs.crazygames.com/requirements/gameplay/
- https://docs.crazygames.com/requirements/ads/
- https://docs.crazygames.com/sdk/intro/
- https://docs.crazygames.com/sdk/video-ads/
- https://docs.crazygames.com/sdk/game/
- https://docs.crazygames.com/sdk/data/
- https://docs.crazygames.com/sdk/user/
- https://docs.crazygames.com/requirements/game-covers/
- https://docs.crazygames.com/requirements/quality/
- https://docs.crazygames.com/resources/basic-launch-metrics/
- https://docs.crazygames.com/resources/crazygames-app/

## Stand im Spiel

> **Stand Schritt 2 des Plans für das neue Spiel (01.10.2026):** Das Spiel speichert wieder im `localStorage` und zahlt einen Offline-Ertrag, bietet aber noch keine Belohnungen an. Boost und Offline-Verdopplung kommen mit Schritt 3. Wo diese Datei unten vom Boost oder von „Kaufen für …“ spricht, beschreibt sie das Spiel vor der Neuausrichtung. Das Datenmodul des SDK (siehe „Speichern“) nutzt das Spiel noch nicht; das gehört zur SDK-Anbindung für den Full Launch.

- **Basic Launch:** Das Paket `dist/crazygames` nutzt den Platzhalter-Adapter `src/ads/crazygames.js`. Er lädt kein SDK, macht keine Anfragen und zeigt keine Werbung.
  - Laut CrazyGames ist Werbung im Basic Launch ohnehin abgeschaltet.
  - Belohnungs-Knöpfe bleiben ausgeblendet. So verlangt es CrazyGames: keine Belohnungs-Knöpfe ohne Wirkung.
  - Der Boost bleibt über „Kaufen für …“ erreichbar.
- **Sprache:** Englisch, bis das SDK eine Locale liefert. Der Spieler kann wechseln.
- **Speicherstand:** `localStorage` über `createStore` in `src/core/save.js`.

## SDK v3 (HTML5), soweit für uns wichtig

- **Einbinden:** Das Skript `https://sdk.crazygames.com/crazygames-sdk-v3.js` gehört vor den Spielcode. Danach `await window.CrazyGames.SDK.init()`, bevor irgendetwas anderes aufgerufen wird. Die Schnittstelle arbeitet mit Promises.
- **Werbung:**
  - Anfordern mit `window.CrazyGames.SDK.ad.requestAd("midgame" | "rewarded", { adStarted, adFinished, adError })`.
  - Fehler-Codes in `adError`: `adsDisabledBasicLaunch`, `unfilled`, `adblock`, `adCooldown`, `other`.
  - Werbeblocker erkennen: `await window.CrazyGames.SDK.ad.hasAdblock()`.
- **Spiel-Ereignisse:**
  - `game.gameplayStart()` und `game.gameplayStop()` sind Pflicht im Full Launch. Wer das SDK schon im Basic Launch einbindet, muss mindestens `gameplayStart` auslösen, damit die Startgröße gemessen wird.
  - `game.loadingStart()` und `game.loadingStop()` sind optional.
  - Dazu gibt es `game.happytime()` und `game.settings` samt Listener.
- **Sprache:** `window.CrazyGames.SDK.user.systemInfo`. Laut Anforderungen soll das Spiel die Sprache aus der Locale von `systemInfo` nehmen, sonst Englisch.
- **Speichern:** Datenmodul, z. B. `window.CrazyGames.SDK.data.setItem("gold", 100)`. Es ist im Full Launch Pflicht, falls Fortschritt gespeichert wird („Progress Save“).

## Anforderungen an Werbung (Auszug)

Die Regeln zu Belohnungen am 30.09.2026 noch einmal nachgelesen.

- **Nur Werbung über das SDK.** Keine Werbung, bevor man eine angemessene Zeit gespielt hat. Keine Werbung mitten im Spiel, keine Täuschung, keine Ketten aus mehreren Anzeigen, also nicht mehrere Anzeigen für eine einzige Belohnung.
- **Zwischenanzeigen (midgame):**
  - nur an logischen Pausen, nie auf Navigations-Knöpfen (Menü, Einstellungen, Shop)
  - Die Häufigkeit (höchstens alle 3 Minuten) steuert CrazyGames selbst. Zu frühe Anfragen ignoriert das SDK.
- **Während einer Anzeige:**
  - Spiel anhalten und Bedienung sperren, bis `adFinished` oder `adError` kommt.
  - Ton stumm schalten; wir haben keinen Ton.
- **Belohnungs-Anzeigen:**
  - nicht zu oft anbieten, mit Timer oder ausgeblendetem Knopf
  - Der Knopf gehört an eine gleichbleibende Stelle, nicht auf einen Bildschirm mit aktivem Spielgeschehen.
  - Der Weg ohne Werbung sieht gleich aus (Größe, Schrift, Farbe).
  - Es muss klar sein, dass die Belohnung freiwillig ist und dass Werbung kommt, z. B. durch ein Video-Symbol.
  - Es gibt eine Alternative ohne Werbung, z. B. mit Spielwährung kaufen.
  - Bei `adError` keine Belohnung.
- **Werbeblocker:** Das Spiel muss trotzdem normal spielbar sein. Belohnungs-Knöpfe ohne Wirkung sind verboten.

## Wie das bisherige Spiel das umgesetzt hat

Gilt für das Spiel vor Schritt 1 des neuen Plans; mit Schritt 3 kommt eine neue Umsetzung nach den Entscheidungen unten.

- **Werbung nur auf Wunsch:**
  - Belohnungen gibt es nur nach einem Klick auf „Werbung ansehen“: 10 min doppelte Einnahmen, Offline-Ertrag verdoppeln.
  - Den Boost bietet das Spiel erst an, wenn etwas produziert.
  - Im Dialog „Willkommen zurück!“ ist „Weiter“ vorausgewählt; Enter startet also keine Anzeige.
  - Nur eine Anzeige zur Zeit, und die Belohnung erst nach einer tatsächlich gesehenen Anzeige (`src/core/adflow.js`).
- **Zwischenanzeigen:** vorerst keine (Entscheidung vom 30.09.2026). Das Spiel ruft `showInterstitial` nicht auf; ein Browser-Test prüft, dass nach einem Prestige keine Anzeige kommt.
- **Während einer Anzeige** sperrt ein modaler Dialog die ganze Oberfläche; auch mehrfaches Escape schließt ihn nicht. Antwortet ein Adapter nicht, gilt die Anzeige nach 2 Minuten als beendet, ohne Belohnung.
- **Gestaltung:**
  - Werbe-Knöpfe tragen ein Video-Symbol und sind genauso groß wie der Knopf ohne Werbung daneben: „Kaufen für …“ beim Boost, „Weiter“ im Offline-Dialog. Browser-Tests messen das.
  - Läuft der Boost, ist das Angebot ausgeblendet, und ein Timer zeigt die Restzeit.
  - Nach einer Belohnung erscheint eine Meldung. Gibt es keine Anzeige, bittet eine Meldung, es später noch einmal zu versuchen.

## Werbung: Entscheidungen vom 30.09.2026

Diese Regeln gelten für die Neuausrichtung des Spiels (siehe `CLAUDE.md`). Alle Zahlen sind Startwerte; nach dem Full Launch passen wir sie an die Daten an.

- **Boost per Anzeige:** doppelte Einnahmen für 10 Minuten.
  - Die Restzeit läuft nur, solange das Spiel sichtbar ist. Wer das Spiel schließt oder den Tab wechselt, verliert nichts davon. Den Offline-Ertrag verdoppelt der Boost nicht; dafür gibt es eine eigene Anzeige.
  - Kein Stapeln: Solange ein Boost läuft, ist das Angebot ausgeblendet, und ein Timer zeigt die Restzeit.
  - Höchstens 6 Boosts per Anzeige pro Kalendertag (Ortszeit des Geräts), also höchstens eine Stunde doppelte Einnahmen per Anzeige am Tag. Danach bleibt der Kauf.
  - Alternative ohne Werbung: Kauf mit Spielwährung für so viel, wie das Spiel in 5 Minuten einnimmt. Der Knopf ist genauso groß und gestaltet wie der Werbe-Knopf.
  - Das Angebot steht in einem eigenen Bereich, nicht in der Spielszene.
- **Offline-Ertrag verdoppeln:** im Dialog „Willkommen zurück!“, einmal je Rückkehr; „Weiter“ ist vorausgewählt.
  - Alternative ohne Werbung: Kauf für die Hälfte des Offline-Ertrags. Mit der Anzeige bringt das Verdoppeln also 100 % mehr, mit dem Kauf 50 %.
- **Zwischenanzeigen:** vorerst keine.

**Begründung** (Quellen in `docs/recherche/`):
- **10 Minuten statt 4 Stunden:**
  - Beide Vorbilder geben 4 Stunden. Sie sind Handy-Spiele; wir nehmen an, dass man dort mehrmals am Tag kurz hineinschaut.
  - CrazyGames nennt in seinen Tipps für Clicker-Spiele als Beispiel „2x click damage for 10 minutes“ (https://docs.crazygames.com/resources/monetizing-clicker/, nachgelesen am 30.09.2026). Laut der Recherche nennt dieselbe Seite für Clicker 15 Minuten durchschnittliche Spielzeit.
  - Ein Boost von 4 Stunden würde im Browser vermutlich fast jede Sitzung ganz abdecken und wäre dann einfach die normale Geschwindigkeit. Echte Sitzungsdaten für unser Spiel gibt es erst nach dem Start.
- **Uhr nur beim Spielen:** Ein 10-Minuten-Boost, der offline abläuft, wäre beim Verlassen verschenkt. So ist jede Anzeige ihre vollen 10 Minuten wert, und Boost und Offline-Verdopplung überschneiden sich nicht.
- **Kein Stapeln, dafür eine Tagesgrenze:**
  - Laut einer Verhaltensanalyse zu Idle Miner Tycoon macht Stapeln das Nachlegen zur Pflichtaufgabe; eine Tagesgrenze wie bei AdVenture Capitalist ist fairer.
  - CrazyGames verlangt außerdem, Belohnungen nicht zu oft anzubieten und das mit einem Timer oder einem ausgeblendeten Knopf zu zeigen.
  - Die Zahl 6, also eine Stunde am Tag, ist ein Startwert ohne Datengrundlage.
- **Kauf als Alternative beim Offline-Ertrag:** CrazyGames verlangt eine Alternative zur Anzeige („Provide an alternative to watching an ad“). Zum halben Preis lohnt sich der Kauf, die Anzeige bleibt aber doppelt so ergiebig.
- **Keine Zwischenanzeigen:** Entscheidung des Nutzers vom 30.09.2026, vorerst. Zum Vergleich nennt CrazyGames auf derselben Seite für die besten Clicker-Spiele „5.5 ad impressions per play, with about half coming from rewarded ads“.

**Stand im bisherigen Spiel (`src/`):**
- Umgesetzt: Boost 10 Minuten mit Kauf für 5 Minuten Produktion. Die Zwischenanzeige nach dem Prestige ist entfernt.
- Es fehlen noch:
  - die Pause der Restzeit außerhalb des Spiels (heute läuft sie auch offline ab)
  - die Tagesgrenze
  - die Alternative ohne Werbung beim Offline-Ertrag
  - der eigene Bereich für das Angebot

## Offene Punkte für den Full Launch

- Das SDK einbinden. Dazu kommt die SDK-Adresse in `allowedUrls` des Ziels `crazygames`, sonst schlägt die URL-Prüfung an.
- `requestAd` in `src/ads/crazygames.js` auf die Schnittstelle abbilden:
  - `showRewarded()` liefert `true` nur bei `adFinished`.
  - `showInterstitial()` endet bei `adFinished` oder `adError`. Das Spiel ruft es derzeit nicht auf.
  - `canShowRewarded()` ist `false` bei Werbeblocker oder Basic Launch.
- `gameplayStart` und `gameplayStop`, `loadingStart` und `loadingStop` auslösen.
- Die Sprache aus `user.systemInfo` übernehmen.
- Den Speicherstand über das Datenmodul führen.
- **Alternative ohne Werbung:** CrazyGames verlangt zu jeder Belohnung eine Alternative ohne Werbung. Für den Boost gibt es sie (Kauf mit Bohnen), für „Offline-Ertrag verdoppeln“ noch nicht. Entschieden ist ein Kauf für die Hälfte des Offline-Ertrags (siehe unten); umgesetzt ist er noch nicht.
- **Boost-Karte:** Laut CrazyGames gehört der Knopf nicht auf einen Bildschirm mit aktivem Spielgeschehen („The request button should not appear on an active gameplay screen.“). Entschieden am 30.09.2026: Das Angebot kommt in einen eigenen Bereich, nicht in die Spielszene. Im bisherigen Spiel liegt die Karte noch unter der Klickfläche.
- **Offene Auslegung:** Während einer Anzeige ist die Bedienung gesperrt, die Produktion läuft aber weiter. CrazyGames verlangt, dass das Spiel während einer Anzeige pausiert und der Spieler nicht vorankommt. Ob passive Produktion dazu zählt, vor dem Full Launch klären; notfalls die Zeit der Anzeige nicht mitrechnen.
- **Nicht geprüft:** Das Overlay ist ein modaler `<dialog>` und liegt damit über allem anderen auf der Seite. Zeichnet ein Werbe-SDK seine Anzeige im Spiel selbst, etwa mit hohem `z-index`, könnte das Overlay sie verdecken. Beim Bau eines echten Adapters prüfen und das Overlay notfalls ausblenden, sobald die Anzeige startet.
- **Developer-Terms:** Die Fassung vom 18.08.2025 ist in `CLAUDE.md` zusammengefasst, ausführlicher in [docs/recherche/idle-miner-und-adventure-capitalist.md](recherche/idle-miner-und-adventure-capitalist.md). Das ist keine Rechtsberatung; vor der Zustimmung liest der Nutzer die Bedingungen selbst.

## Weitere Anforderungen, nachgelesen am 28.09.2026 (Auszug)

- **Lesbarkeit:** Texte und Bilder müssen bei `devicePixelRatio` 1 lesbar sein, in diesen iframe-Größen (16:9):
  - Desktop ohne Vollbild: 907×510, 1216×684, 1077×606, 821×462
  - Desktop im Vollbild: 1366×768, 1920×1080, 1536×864, 1280×720
  - Handy: 800×450; Tablet: 1080×607

  Der Layout-Test (`tests/browser/layout.spec.js`) prüft alle diese Größen und dazu 390×844 (Handy hochkant).
- **Gleiche Physik bei jeder Bildwiederholrate** (z. B. 144 Hz): Das Spiel rechnet mit der vergangenen Zeit, nicht pro Frame.
- **Browser und Geräte:**
  - Das Spiel muss in Chrome und Edge laufen. Läuft es in Safari schlecht, schaltet CrazyGames es dort ab.
  - Auf Chromebooks muss es mit 4 GB RAM flüssig laufen.
  - Maus, Tastatur und, falls für Handys freigegeben, Touch.
- **Publikum:** ab 13 Jahren, PEGI 12.
- **Full Launch:** Neue Spieler landen direkt im Spiel, höchstens ein Klick davor. Das Spiel hat keinen Startbildschirm.
- **Belohnungen:** Nach der Anzeige muss klar sein, dass es die Belohnung gab, etwa mit einer Meldung. Gibt es gerade keine Anzeige, soll das Spiel ermutigen, es später noch einmal zu versuchen. Beides macht das Spiel mit einer kurzen Meldung.

## Basic Launch: So bewertet CrazyGames

Quelle: https://docs.crazygames.com/resources/basic-launch-metrics/

- **Dauer:** Die Phase endet, wenn das Spiel mindestens 7 Tage online ist und mindestens 500 Spiele hat. Ohne 500 Spiele endet sie nach 21 Tagen.
- **Kennzahlen** im Developer-Dashboard, täglich aktualisiert. Die Richtwerte stammen von CrazyGames:
  - Durchschnittliche Spielzeit je Sitzung: Erfolgreiche Spiele liegen oft bei 10 Minuten oder mehr.
  - Tag-1-Retention, also der Anteil der Spieler, die am Tag nach der ersten Sitzung wiederkommen: Starke Spiele erreichen oft 10–15 %.
  - Conversion, also der Anteil der Spieler, die mindestens eine Minute spielen: Die besten Spiele erreichen 80 % und mehr, laden in unter 10 Sekunden und sind kleiner als 20 MB.
- **Updates** sind jederzeit möglich und werden automatisch freigegeben.
- Mit guten Kennzahlen kann das Spiel in den Full Launch.
- **Tipps von CrazyGames:** klare Ziele, gespeicherter Fortschritt, tägliche Anreize wie ein Login-Bonus oder tägliche Aufgaben, schneller Einstieg, eine kurze Einführung im Spiel. Einen täglichen Anreiz und eine Einführung hat das Spiel noch nicht.

## Einreichung: Was dafür gebraucht wird

Quellen: https://docs.crazygames.com/requirements/intro/ und https://docs.crazygames.com/requirements/game-covers/

Die Einreichung selbst ist nicht Teil dieses Projekts (CLAUDE.md). Hier steht nur, was dafür vorbereitet sein muss:
- Beschreibung des Spiels und der Steuerung.
- **Drei Cover-Bilder** im selben Stil: Querformat 1920×1080 (16:9), Hochformat 800×1200 (2:3) und quadratisch 800×800 (1:1).
  - Als Text nur der Spieltitel. Keine Rahmen, keine Icons oder Store-Logos, nichts Verschwommenes, keine Bilder ohne Nutzungsrecht.
  - CrazyGames rät von einem bloßen Screenshot ab.
- **Zwei Vorschau-Videos**, beide Pflicht: Querformat 1080p (16:9) und Hochformat 1080p (2:3).
  - 15–20 Sekunden, höchstens 50 MB, ohne Ton; das erste Bild ist das Cover.
  - Ohne schwarze Balken, Mauszeiger, Logo-Einblendung, „Play Now“ oder andere Werbetexte, nicht vorgespult.
- Cover und Videos zeigen den Titel. Sie sollten darum erst entstehen, wenn der Titel feststeht.
