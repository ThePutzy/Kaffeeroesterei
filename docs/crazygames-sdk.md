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

- **Nur Werbung über das SDK.** Keine Werbung, bevor man eine angemessene Zeit gespielt hat. Keine Werbung mitten im Spiel, keine Täuschung, keine Ketten aus mehreren Anzeigen.
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

## Wie das Spiel das heute umsetzt

- **Werbung nur auf Wunsch:**
  - Belohnungen gibt es nur nach einem Klick auf „Werbung ansehen“: 10 min doppelte Einnahmen, Offline-Ertrag verdoppeln.
  - Den Boost bietet das Spiel erst an, wenn etwas produziert.
  - Im Dialog „Willkommen zurück!“ ist „Weiter“ vorausgewählt; Enter startet also keine Anzeige.
  - Nur eine Anzeige zur Zeit, und die Belohnung erst nach einer tatsächlich gesehenen Anzeige (`src/core/adflow.js`).
- **Zwischenanzeige:** nur nach einem Prestige, frühestens 5 Minuten nach der letzten und frühestens 5 Minuten nach dem Start des Spiels, also auch nach einem Neuladen. Ein Prestige ist laut Simulator frühestens nach etwa 20 Minuten möglich (Szenario „active“, bei „idle“ nach etwa 33 Minuten); der simulierte Spieler nimmt es nach etwa 54 Minuten.
- **Während einer Anzeige** sperrt ein modaler Dialog die ganze Oberfläche; auch mehrfaches Escape schließt ihn nicht. Antwortet ein Adapter nicht, gilt die Anzeige nach 2 Minuten als beendet, ohne Belohnung.
- **Gestaltung:**
  - Werbe-Knöpfe tragen ein Video-Symbol und sind genauso groß wie der Knopf ohne Werbung daneben: „Kaufen für …“ beim Boost, „Weiter“ im Offline-Dialog. Browser-Tests messen das.
  - Läuft der Boost, ist das Angebot ausgeblendet, und ein Timer zeigt die Restzeit.
  - Nach einer Belohnung erscheint eine Meldung. Gibt es keine Anzeige, bittet eine Meldung, es später noch einmal zu versuchen.

## Offene Punkte für den Full Launch

- Das SDK einbinden. Dazu kommt die SDK-Adresse in `allowedUrls` des Ziels `crazygames`, sonst schlägt die URL-Prüfung an.
- `requestAd` in `src/ads/crazygames.js` auf die Schnittstelle abbilden:
  - `showRewarded()` liefert `true` nur bei `adFinished`.
  - `showInterstitial()` endet bei `adFinished` oder `adError`.
  - `canShowRewarded()` ist `false` bei Werbeblocker oder Basic Launch.
- `gameplayStart` und `gameplayStop`, `loadingStart` und `loadingStop` auslösen.
- Die Sprache aus `user.systemInfo` übernehmen.
- Den Speicherstand über das Datenmodul führen.
- **Alternative ohne Werbung:** CrazyGames verlangt zu jeder Belohnung eine Alternative ohne Werbung. Für den Boost gibt es sie (Kauf mit Bohnen), für „Offline-Ertrag verdoppeln“ noch nicht. Vor dem Full Launch ergänzen oder die Verdopplung weglassen.
- **Offene Auslegung:** Ist die Boost-Karte unter der Klickfläche ein „Bildschirm mit aktivem Spielgeschehen“? Bei einem Idle-Spiel ist das nicht eindeutig. Vor dem Full Launch klären, notfalls die Karte in einen eigenen Bereich verlegen.
- **Offene Auslegung:** Während einer Anzeige ist die Bedienung gesperrt, die Produktion läuft aber weiter. CrazyGames verlangt, dass das Spiel während einer Anzeige pausiert und der Spieler nicht vorankommt. Ob passive Produktion dazu zählt, vor dem Full Launch klären; notfalls die Zeit der Anzeige nicht mitrechnen.
- **Nicht geprüft:** Das Overlay ist ein modaler `<dialog>` und liegt damit über allem anderen auf der Seite. Zeichnet ein Werbe-SDK seine Anzeige im Spiel selbst, etwa mit hohem `z-index`, könnte das Overlay sie verdecken. Beim Bau eines echten Adapters prüfen und das Overlay notfalls ausblenden, sobald die Anzeige startet.
- Die Developer-Terms sind noch nicht gelesen.

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
