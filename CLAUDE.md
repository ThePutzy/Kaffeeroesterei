# Projekt: Idle-Spiel "Kaffeerösterei" (Thema 1)

Stand der Entscheidungen: 01.10.2026. Diese Datei ist der Kontext für jede Sitzung. Du siehst das Gespräch nicht, in dem der Plan entstanden ist; verlasse dich auf diese Datei.

Der freigegebene Umsetzungsplan (Schritte, Branches, Prüfungen) steht in `docs/umsetzungsplan.md`. Seine sechs Schritte sind umgesetzt und gemergt. Danach hat der Nutzer das Spiel neu ausgerichtet, siehe „Neuausrichtung“. Der Plan für das neue Spiel steht in `docs/umsetzungsplan-neues-spiel.md`.

## Ziel

Ein Browser-Idle-Spiel, das hauptsächlich über Werbung Geld verdienen soll. Erst auf einem Spieleportal (CrazyGames) veröffentlichen, danach auf einer eigenen Domain (vorerst zurückgestellt, siehe Entscheidungen). Kein festes Einnahmeziel, möglichst geringe Kosten, so viel wie möglich soll über Claude Code laufen.

## Entscheidungen

- Technik: reines HTML, CSS und JavaScript (ES-Module), keine Spiel-Engine, kein Server. Das Ergebnis muss als statische Dateien auslieferbar sein.
- Sprachen: Englisch (Pflicht, CrazyGames verlangt es) und Deutsch.
- Thema 1: Kaffeerösterei. Weitere Themen kommen später.
- Spieltitel, vorläufig (30.09.2026): **Full Roast Ahead**, vollständig „Full Roast Ahead: Idle Coffee Roastery“, deutsch „Full Roast Ahead: Idle-Kaffeerösterei“. Auf Titelbildern steht nur „Full Roast Ahead“.
  - Nicht markenrechtlich geprüft; das übernimmt der Nutzer. Recherche: `docs/recherche/spieltitel.md`.
  - Vor dem Basic Launch endgültig festlegen, denn CrazyGames ändert Namen nur, wenn es „totally necessary“ ist.
  - „Roast & Rise“ ist verworfen, weil es ein gleichnamiges iOS-Spiel gibt. Titel nach dem Muster „Idle … Tycoon“ meiden, denn Kolibri Games hat „Idle Tycoon“ als Unionsmarke eingetragen.
- Spielkern und Themendaten sauber trennen, den Baukasten aber nur so weit ausbauen, wie Thema 1 ihn braucht. Ob und wie weit er wiederverwendbar ist und wie mit dem Klon-Eindruck umzugehen ist, entscheiden wir nach Thema 1. Nicht vorab verallgemeinern.
- Vertrieb: zuerst CrazyGames. Poki ist ausgeschlossen (Web-Exklusivität).
- Eigene Domain (Cloudflare Pages mit AdSense H5 Games Ads und einem von Google zertifizierten Einwilligungstool): vorerst zurückgestellt (30.09.2026). Nicht daran arbeiten, bis der Nutzer sie wieder aufnimmt. Das Ziel `web` und die Entwürfe in `docs/entwuerfe/` bleiben, wie sie sind.
- Gewerbe und Steuer hat der Nutzer geklärt. Darum kümmerst du dich nicht.

## Neuausrichtung (29.09.2026)

- Der Nutzer fand das Spiel nach dem Umsetzungsplan (eine Klickfläche mit Erzeugerliste) sehr langweilig und nannte das Aussehen „ein großes Problem“.
- Neue Richtung: eine sichtbare Rösterei. Man röstet selbst, bedient Kunden und automatisiert Schritt für Schritt mit Helfern und Maschinen. Laut Nutzer „schaut [der Prototyp] schon viel besser aus“; seit Schritt 1 des neuen Plans ist er das Spiel.
- Richtung laut Nutzer: ein Erfolg wie Idle Miner Tycoon und AdVenture Capitalist. Planbar ist das nicht, aber es gibt die Richtung vor.
  - Übernehmen: eine kleine erste Fassung, die an der Rückkehrquote gemessen wird; eine sichtbare Kette mit Engpass; frühe Automatik; ehrliche Belohnungsanzeigen; ein eigener Ton.
  - Nicht übernehmen: ihr Aussehen, ihre Figuren, Namen und Zahlen. CrazyGames zahlt nur für Spiele, die sich von bestehenden unterscheiden.
- Berichte dazu: `docs/recherche/`.
- Entschieden (01.10.2026): Der Prototyp ist die Grundlage des neuen Spiels. Die Technik aus `src/` wird übernommen: Speicherstand, Offline-Ertrag, Werbe-Adapter, Texte, Build, Tests. Plan: `docs/umsetzungsplan-neues-spiel.md`.
- Design: Board in Claude Design „Full Roast Ahead – Design“ (01.10.2026) mit drei Logo-Richtungen, den drei CrazyGames-Covern und der Spielansicht mit eigenem Boost-Bereich. Welche Details gelten, entscheidet der Nutzer.
  - Logo: A „Röstetikett“, gewählt vom Nutzer (01.10.2026). Im Spiel steht es während des Ladens in der Mitte und dient als Symbol im Browser-Tab; die Spielansicht selbst bleibt wie auf dem Board ohne Logo.
  - Cover und Vorschauvideos für die Einreichung: `media/crazygames/`, erzeugt mit `npm run media`.

## Spielumfang Thema 1 (erste Version)

- Idle-/Clicker-Kern: Währung, Erzeuger mit exponentiell steigenden Kosten, Upgrades, Erfolge, Prestige.
- Offline-Ertrag und Speicherstand im Browser. Speicher darf ausfallen (Inkognito): immer mit try/catch, das Spiel läuft trotzdem.
- Bedienbar auf Handy und Desktop.
- Werbung, nur über den Werbe-Adapter:
  - Belohnungs-Anzeige, nur nach ausdrücklicher Entscheidung des Spielers. Die Belohnung darf keinen Wert außerhalb des Spiels haben. Jede Belohnung gibt es auch ohne Werbung, als Kauf mit Spielwährung; CrazyGames verlangt eine Alternative.
    - Boost (30.09.2026): doppelte Einnahmen für 10 Minuten je Anzeige.
      - Die Restzeit läuft nur, solange das Spiel sichtbar ist.
      - Kein Stapeln: Solange ein Boost läuft, ist das Angebot ausgeblendet.
      - Höchstens 6 Boosts per Anzeige pro Kalendertag.
      - Kauf ohne Werbung für so viel, wie das Spiel in 5 Minuten einnimmt.
      - Das Angebot steht in einem eigenen Bereich, nicht in der Spielszene.
    - Offline-Ertrag verdoppeln (30.09.2026): im Willkommen-Dialog, einmal je Rückkehr. Kauf ohne Werbung für die Hälfte des Offline-Ertrags.
    - Begründung und was davon im Code schon umgesetzt ist: `docs/crazygames-sdk.md`.
  - Zwischenanzeigen: vorerst keine (Entscheidung des Nutzers, 30.09.2026). `showInterstitial` bleibt in der Schnittstelle, das Spiel ruft es nicht auf. Kommen sie später, dann nur an natürlichen Pausen (zum Beispiel nach einem Prestige), nie mitten im Spiel, nie nach jeder Aktion.

## Struktur

- `src/core/`: Spielregeln (`model.js`), Oberfläche, Ton, Texte, Speicherstand, Werbe-Ablauf
- `src/ads/`: Schnittstelle mit `showRewarded` und `showInterstitial`. Adapter: `none` (Entwicklung und Tests), `crazygames`, später `adsense-h5`
- `themes/<name>/`: `theme.json` (alle Zahlen), Texte `en` und `de`, die Szene als SVG-Code (`scene.js`), Farben. Format: `docs/themenformat.md`
- `tools/`: Balance-Simulator, Größen-Check, Cover und Vorschauvideos (`media.mjs`), Logo aus der Schrift (`logo/`)
- `tests/`: Browser-Test
- `docs/recherche/`: Recherche-Berichte (Vergleichsspiele, Vorbilder)
- `media/crazygames/`: Cover und Vorschauvideos für die Einreichung
- Build: ein Paket pro Ziel, zum Beispiel `dist/crazygames` und `dist/web`

## Regeln

- Alles Original: keine fremden Marken, Figuren, Grafiken, Namen oder Vorlagen.
- Startpaket Ziel: unter 2 MB.
- Keine externen Anfragen aus dem Spiel, außer über den Werbe-Adapter des jeweiligen Ziels. Im CrazyGames-Paket keine eigene Werbung.
- Keine Zugangsdaten, Schlüssel oder Publisher-IDs im Repository. Platzhalter in einer Konfigurationsdatei.
- Vor dem Bau eines Adapters die aktuelle Doku lesen (CrazyGames SDK: https://docs.crazygames.com/sdk/intro/), nicht aus dem Gedächtnis bauen.
- Eine Aufgabe = ein Branch, klein halten.
- Vor jedem Pull Request: Tests und Balance-Simulator laufen, Größen-Check ist grün.
- Lässt sich der Browser-Test in der Cloud-Umgebung nicht ausführen (zum Beispiel Browser nicht installierbar), das im Pull Request klar schreiben und nicht als bestanden ausgeben.
- Im Pull Request immer benennen, was geändert wurde und was nicht geprüft werden konnte. Nichts erfinden.
- Code und Kommentare Englisch, Dokumentation Deutsch.

## Was bekannt ist über CrazyGames (Quellen: docs.crazygames.com und die Developer-Terms, Stand 30.09.2026)

- Erst Basic Launch (ohne SDK, ohne Werbung), dann Full Launch mit SDK.
- Nur Werbung über deren SDK, keine externen Anzeigen.
- Ablehnungsgründe unter anderem: fehlendes Englisch, unoriginale Inhalte (Klone), Themen, die sich an Kinder richten, PEGI-12 nicht eingehalten.
- Developer-Terms, Fassung vom 18.08.2025, am 29.09.2026 von Claude gelesen. Keine Rechtsberatung; der Nutzer liest sie vor der Zustimmung selbst. Ausführlich in `docs/recherche/idle-miner-und-adventure-capitalist.md`.
  - Geld gibt es erst im Full Launch. Einen Prozentsatz nennen die Bedingungen nicht; die Zahlung richtet sich nach den Besuchern und der Leistung der Werbung.
  - Voraussetzungen für die Zahlung: kein Branding eines anderen Portals, das SDK in der aktuellen Version, keine Werbung außerhalb des SDK und genug Originalität, um sich von bestehenden Spielen zu unterscheiden.
  - 50 % mehr, wenn das Spiel in den zwei Monaten nach dem Full Launch im Browser nur auf CrazyGames erscheint. Steam und App-Stores zählen dabei nicht. Ob eine eigene Domain zählt, klären die gelesenen Stellen nicht.
  - Updates spätestens gleichzeitig mit anderen Plattformen; wesentliche Fehler umgehend beheben.
  - CrazyGames darf das Spiel jederzeit ohne Ankündigung entfernen.
  - Laufzeit ein Jahr ab dem Full Launch. Sie verlängert sich automatisch, wenn niemand mindestens einen Monat vorher kündigt. Nach dem Ende darf CrazyGames das Spiel noch bis zu einem Jahr zeigen.

## Nicht deine Aufgabe

Konten anlegen, Einreichung bei CrazyGames, AdSense-Bewerbung, Domain, Zahlungen, die markenrechtliche Prüfung von Titel und Namen. Rechtstexte (Datenschutz, Impressum) nur als Entwurf, der Nutzer prüft sie.

## Später auf der eigenen Seite

Vorerst zurückgestellt (30.09.2026). Wenn sie kommt: Anleitung, Über uns, Datenschutz und Impressum als eigene Seiten, auch als Inhalt für Suchmaschinen.
