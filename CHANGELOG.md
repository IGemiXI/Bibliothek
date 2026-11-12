# Änderungen

## 0.7.3
- Fehler behoben: Bibliothek startete nach Neustart nicht, wenn Windows die Exklusiv-Einstellung ignoriert – jetzt zusätzlich im Autostart abgesichert
- Autostart-Eintrag wird bei jedem Start geprüft und repariert
- Startprotokoll unter `%APPDATA%\Bibliothek\start.log`

## 0.7.2
- Exklusiv-Modus: Bibliothek ist nach der PIN sofort da, Explorer startet dahinter – Autostart-Programme, Infobereich und Datei-Explorer funktionieren wie gewohnt; bei einem Absturz bleibt der normale Desktop

## 0.7.1
- Schnellstart-Kacheln vom Zweitbildschirm erscheinen auch links in der Seitenleiste auf Bildschirm 1

## 0.7 – Wechsel ohne Hänger
- <kbd>Win</kbd> und <kbd>Win</kbd> + <kbd>Tab</kbd> wechseln jetzt sofort direkt im Helfer – ohne Warteschlange
- „Zurück“ kennt immer das zuletzt benutzte Fenster, egal wie du gewechselt hast (auch per Maus)
- Tastenabfrage erneuert sich alle 30 Sekunden, damit Windows sie nicht still abschaltet
- Fensterliste deutlich schneller (Programmpfade ohne Get-Process)

## 0.6.3
- Fehler behoben: Fenster auf dem Zweitbildschirm ließen sich über das X nicht schließen
- Zweitbildschirm zeichnet nur noch neu, wenn sich Fenster ändern (Uhr & Messwerte laufen trotzdem live)

## 0.6.2
- Fehler behoben: Taskleiste kam nach Win + Shift + S auf dem Zweitbildschirm zurück – ein Wächter blendet sie jetzt sofort wieder aus
- Fehler behoben: Ersatzbuchstabe schien hinter durchsichtigen Logos durch

## 0.6.1
- Icon-Auswahl mit Marken-Logos von Simple Icons (Claude, WhatsApp, YouTube & über 3.000 weitere) in Original, Weiß oder Gold – ohne Schlüssel
- Website-Kacheln: zusätzlich das Symbol der Website

## 0.6 – Eigene Icons
- Icons für Programme und Schnellstart-Kacheln selbst auswählen: Icon-Sammlung von SteamGridDB oder eigenes Bild
- Programme: Rechtsklick → „Icon ändern“ (gilt überall)
- Zweitbildschirm: im Bearbeiten-Modus „Bild“ an jeder Kachel

## 0.5.1
- <kbd>Win</kbd> + <kbd>Tab</kbd> ist jetzt ein Schalter: Die Zweitbildschirm-Seite bleibt vorne, bis du wieder drückst – auch wenn du ins Spiel klickst. Der Fokus bleibt im Spiel.

## 0.5 – Schneller Wechsel
- „Zum Spiel“: läuft ein Spiel schon, springt die Bibliothek direkt hinein
- <kbd>Win</kbd> + <kbd>Tab</kbd> holt die Seite auf dem Zweitbildschirm nach vorne und wieder zurück
- <kbd>Win</kbd> holt die Bibliothek auch aus Vollbild-Spielen nach vorne
- Fenster nutzen den ganzen Bildschirm – der Platz der Taskleiste wird freigegeben
- Websites öffnen als neuer Tab im vorhandenen Browser

## 0.4 – Bilder
- „Bilder auswählen“ für alle Spiele: Cover und Titelbild per Klick
- Automatik nimmt nur das bestbewertete Bild, ungeeignete Bilder werden gefiltert
- World of Warcraft öffnet Battle.net statt Direktstart

## 0.3 – Ordnung & Zweitbildschirm
- Programme in Kategorien mit „Häufig genutzt“ und Suche
- Scharfe Icons (bis 256 px), Store-App-Logos
- Zweitbildschirm: Kacheln passen ihre Größe an, Bearbeiten-Modus
- Zwei Windows-Helfer: Bedienung wartet nie auf Hintergrundarbeit
- Realm-Name für WoW, Cover-Status in den Einstellungen

## 0.2 – Mehr Bildschirme
- Eigene Seite auf jedem Zweitbildschirm mit Schnellstart
- Cover über SteamGridDB und Steam-Shop
- Namensabfrage beim ersten Start („GEMIX Bibliothek“)
- Windows-Taste wechselt zwischen Bibliothek und Spiel

## 0.1 – Erster Prototyp
- Spiele aus Steam, Battle.net, Epic, Riot und GOG
- Programme aus dem Startmenü, Ordner, Eingangskorb
- Windows-Funktionen als Kacheln, Startmodi bis Exklusiv
