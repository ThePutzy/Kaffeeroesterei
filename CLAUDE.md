# Projekt: Idle-Spiel "Kaffeerösterei" (Thema 1)

Stand der Entscheidungen: 28.09.2026. Diese Datei ist der Kontext für jede Sitzung. Du siehst das Gespräch nicht, in dem der Plan entstanden ist; verlasse dich auf diese Datei.

Der freigegebene Umsetzungsplan (Schritte, Branches, Prüfungen) steht in `docs/umsetzungsplan.md`.

## Ziel

Ein Browser-Idle-Spiel, das hauptsächlich über Werbung Geld verdienen soll. Erst auf einem Spieleportal (CrazyGames) veröffentlichen, danach auf einer eigenen Domain. Kein festes Einnahmeziel, möglichst geringe Kosten, so viel wie möglich soll über Claude Code laufen.

## Entscheidungen

- Technik: reines HTML, CSS und JavaScript (ES-Module), keine Spiel-Engine, kein Server. Das Ergebnis muss als statische Dateien auslieferbar sein.
- Sprachen: Englisch (Pflicht, CrazyGames verlangt es) und Deutsch.
- Thema 1: Kaffeerösterei. Weitere Themen kommen später.
- Spielkern und Themendaten sauber trennen, den Baukasten aber nur so weit ausbauen, wie Thema 1 ihn braucht. Ob und wie weit er wiederverwendbar ist und wie mit dem Klon-Eindruck umzugehen ist, entscheiden wir nach Thema 1. Nicht vorab verallgemeinern.
- Vertrieb: zuerst CrazyGames. Danach eigene Domain (Cloudflare Pages) mit AdSense H5 Games Ads und einem von Google zertifizierten Einwilligungstool. Poki ist ausgeschlossen (Web-Exklusivität).
- Gewerbe und Steuer hat der Nutzer geklärt. Darum kümmerst du dich nicht.

## Spielumfang Thema 1 (erste Version)

- Idle-/Clicker-Kern: Währung, Erzeuger mit exponentiell steigenden Kosten, Upgrades, Erfolge, Prestige.
- Offline-Ertrag und Speicherstand im Browser. Speicher darf ausfallen (Inkognito): immer mit try/catch, das Spiel läuft trotzdem.
- Bedienbar auf Handy und Desktop.
- Werbung, nur über den Werbe-Adapter:
  - Belohnungs-Anzeige, nur nach ausdrücklicher Entscheidung des Spielers (zum Beispiel 10 Minuten doppelte Einnahmen, Offline-Ertrag verdoppeln). Die Belohnung darf keinen Wert außerhalb des Spiels haben.
  - Zwischenanzeige nur an natürlichen Pausen (zum Beispiel nach einem Prestige). Nie mitten im Spiel, nie nach jeder Aktion.

## Struktur

- `src/core/`: Wirtschaft, Speicherstand, Offline-Ertrag, Oberfläche
- `src/ads/`: Schnittstelle mit `showRewarded` und `showInterstitial`. Adapter: `none` (Entwicklung und Tests), `crazygames`, später `adsense-h5`
- `themes/<name>/`: `theme.json`, Texte `en` und `de`, eigene SVG-Grafiken
- `tools/`: Balance-Simulator, Größen-Check
- `tests/`: Browser-Test
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

## Was bekannt ist über CrazyGames (Quelle: docs.crazygames.com/faq, Stand 28.09.2026)

- Erst Basic Launch (ohne SDK, ohne Werbung), dann Full Launch mit SDK.
- Nur Werbung über deren SDK, keine externen Anzeigen.
- Ablehnungsgründe unter anderem: fehlendes Englisch, unoriginale Inhalte (Klone), Themen, die sich an Kinder richten, PEGI-12 nicht eingehalten.
- Die Developer-Terms wurden noch nicht gelesen.

## Nicht deine Aufgabe

Konten anlegen, Einreichung bei CrazyGames, AdSense-Bewerbung, Domain, Zahlungen. Rechtstexte (Datenschutz, Impressum) nur als Entwurf, der Nutzer prüft sie.

## Später auf der eigenen Seite

Anleitung, Über uns, Datenschutz und Impressum als eigene Seiten, auch als Inhalt für Suchmaschinen.
