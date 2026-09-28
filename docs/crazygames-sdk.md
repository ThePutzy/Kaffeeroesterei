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
  - Nur eine Anzeige zur Zeit, und die Belohnung erst nach einer tatsächlich gesehenen Anzeige (`src/core/adflow.js`).
- **Zwischenanzeige:** nur nach einem Prestige, frühestens 5 Minuten nach der letzten. Das erste Prestige kommt laut Simulator nach etwa 50 Minuten.
- **Während einer Anzeige** sperrt ein modaler Dialog die ganze Oberfläche.
- **Gestaltung:**
  - Werbe-Knöpfe tragen ein Video-Symbol und sind genauso groß wie die Alternative („Kaufen für …“ oder „Weiter“).
  - Läuft der Boost, ist das Angebot ausgeblendet, und ein Timer zeigt die Restzeit.

## Offene Punkte für den Full Launch

- Das SDK einbinden. Dazu kommt die SDK-Adresse in `allowedUrls` des Ziels `crazygames`, sonst schlägt die URL-Prüfung an.
- `requestAd` in `src/ads/crazygames.js` auf die Schnittstelle abbilden:
  - `showRewarded()` liefert `true` nur bei `adFinished`.
  - `showInterstitial()` endet bei `adFinished` oder `adError`.
  - `canShowRewarded()` ist `false` bei Werbeblocker oder Basic Launch.
- `gameplayStart` und `gameplayStop`, `loadingStart` und `loadingStop` auslösen.
- Die Sprache aus `user.systemInfo` übernehmen.
- Den Speicherstand über das Datenmodul führen.
- **Offene Auslegung:** Ist die Boost-Karte neben der Klickfläche ein „Bildschirm mit aktivem Spielgeschehen“? Bei einem Idle-Spiel ist das nicht eindeutig. Vor dem Full Launch klären, notfalls die Karte in einen eigenen Bereich verlegen.
- Die Developer-Terms sind noch nicht gelesen.
