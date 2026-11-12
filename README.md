# Bibliothek

Deine eigene Startoberfläche für Windows im WoW-Forever-Stil. Spiele, Programme und Ordner, automatisch erkannt und an einem Ort, ohne den Windows-Desktop.

Beim ersten Start fragt die Bibliothek, wie du genannt werden möchtest. Oben steht dann z. B. **GEMIX Bibliothek**.

## Installieren

**Empfohlen, mit automatischen Updates:**

1. **Node.js (LTS)** installieren: https://nodejs.org
2. **Git** installieren: https://git-scm.com/download/win
3. Eingabeaufforderung öffnen und eingeben:
   ```
   git clone https://github.com/IGemiXI/bibliothek.git C:\Bibliothek
   ```
4. In `C:\Bibliothek` die Datei **START.bat** doppelklicken.

Bei jedem Start über START.bat werden neue Versionen automatisch geladen. Alternativ gibt es in den Einstellungen „Nach Updates suchen“.

**Ohne Git:** Auf GitHub auf **Code → Download ZIP** klicken, an einen festen Ort entpacken (z. B. `C:\Bibliothek`) und START.bat starten. Updates musst du dann neu herunterladen.

Den Ordner nach dem Einrichten nicht mehr verschieben, sonst findet der Autostart die Bibliothek nicht.

## Bedienung

| Was | Wie |
|---|---|
| Zwischen Bibliothek und Spiel/Fenster wechseln | **Windows-Taste** (Win + E, Win + Shift + S usw. funktionieren weiter) |
| Suchen | einfach lostippen oder `Strg + K` |
| Bibliothek nach vorne holen | Windows-Taste, Maus in die linke untere Ecke oder `Strg + Alt + G` |
| Zwischen offenen Fenstern wechseln | Leiste „Geöffnet“ oben (bei mehreren Bildschirmen mit Bildschirmnummer) oder `Alt + Tab` |
| Controller | A = öffnen, B = zurück, Y = Suche, LB/RB = Bereich wechseln |

## Was erkannt wird

- **Spiele:** Steam (mit Covern und Spielzeit), Battle.net (alle WoW-Varianten starten direkt, mit letztem Charakter), Epic, Riot, GOG
- **Programme:** Startmenü und Store-Apps
- **Spielzeit:** Die Bibliothek erfasst sie selbst, egal wie das Spiel gestartet wurde.
- Neue Installationen erscheinen automatisch.

## Zweitbildschirme

Auf jedem weiteren Monitor zeigt die Bibliothek eine eigene Seite statt des Windows-Hintergrunds: Begrüßung mit Uhr, **Schnellstart** (Websites und Programme, öffnen sich direkt auf diesem Bildschirm) und die Fenster, die dort gerade offen sind. Die Seite liegt immer unter deinen Fenstern, wie ein Hintergrund.

## Cover

Steam-Spiele bringen ihre Cover mit. Für alle anderen (Battle.net, Riot, Epic, GOG) sucht die Bibliothek automatisch:
- ohne Schlüssel über den Steam-Shop (klappt bei Spielen, die es auch auf Steam gibt)
- mit einem kostenlosen **SteamGridDB-Schlüssel** für praktisch alle Spiele, auch WoW. Den Schlüssel holst du auf https://www.steamgriddb.com/profile/preferences/api und fügst ihn unter Einstellungen → Bibliothek ein.

In den Spiel-Details wechselt „Anderes Cover“ zwischen den gefundenen Bildern.

## Startmodi (Einstellungen → Start)

| Modus | Verhalten |
|---|---|
| Manuell | Start nur über START.bat |
| Mit Windows | Startet nach der Anmeldung automatisch, der Desktop ist kurz zu sehen |
| Exklusiv | Nach der PIN kommt direkt die Bibliothek, kein Windows-Desktop |

**Notfall im Exklusiv-Modus:** `Strg + Alt + Entf` → Task-Manager → „Neuen Task ausführen“ → `explorer` eingeben.

## Daten

Deine Einstellungen liegen in `%APPDATA%\Bibliothek\` und gehören nur dir. Sie werden nicht hochgeladen.
