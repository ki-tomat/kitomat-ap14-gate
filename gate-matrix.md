# AP14.0 — Gate-Matrix

## A. Lokale Payload-Messung

Für jede Fixture werden protokolliert:

| Typ | JSON UTF-8 | Base64 | Zusammenfassung | Issue-Body | vollständige URL | URL zulässig? |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Prompt | 2.730 B | 3.640 Zeichen | 154 Zeichen | 3.850 Zeichen | 4.051 Zeichen | nein |
| Dataset | 1.660 B | 2.216 Zeichen | 140 Zeichen | 2.412 Zeichen | 2.607 Zeichen | nein |
| Branchenmodell | 2.487 B | 3.316 Zeichen | 167 Zeichen | 3.539 Zeichen | 3.776 Zeichen | nein |

Messstand: 14. September 2026. Das JSON wurde nach dem Einlesen mit lexikografisch sortierten Objektschlüsseln kanonisch ohne Einrückung serialisiert und anschließend als UTF-8 nach Base64 kodiert. Die Issue-Zusammenfassung enthält Titel, Typ, Rolle und ID; die URL enthält den URL-kodierten Titel und den vollständigen Issue-Body.

**Ergebnis:** Bereits alle drei realistischen Fixtures überschreiten die vorläufige URL-Grenze von 1.500 Zeichen. Der Standardtransport für Weg A ist daher **Clipboard plus manuelles Einfügen in den Issue-Body**. Eine vorausgefüllte URL darf nur für nachweislich kleinere Payloads angeboten werden.

Zusätzlich werden Grenzfälle knapp unter und über 32 KiB Payload sowie 55.000 Zeichen Issue-Body erzeugt.

## B. Codec-Fälle

| Fall | Erwartung |
| --- | --- |
| Umlaute `äöüß` | verlustfreier Roundtrip |
| Emoji `🍅` | verlustfreier Roundtrip |
| Backticks und Codefence | verlustfreier Roundtrip |
| CRLF und LF | semantisch erhalten bzw. dokumentiert normalisiert |
| fehlender Startmarker | Ablehnung |
| fehlender Endmarker | Ablehnung |
| zwei Markerpaare | Ablehnung |
| ungültiges Base64 | Ablehnung |
| ungültiges UTF-8 | Ablehnung |
| unbekannte Version | Ablehnung |
| unbekanntes Top-Level-Feld | Ablehnung |
| unbekanntes Antwortfeld | Ablehnung |
| falscher Datentyp | Ablehnung |
| Payload über 32 KiB | Ablehnung vor Generierung |

Lokaler Prüfstand vom 14. September 2026: **24/24 automatisierte Codec-Tests bestanden**. Abgedeckt sind die drei Fixture-Roundtrips, Unicode und Zeilenenden, kurze und zu lange Pre-fill-URLs, Marker-, Base64-, UTF-8-, JSON-, Versions-, Feld-, Typ- und Bestätigungsfehler sowie die Grenzwerte 32 KiB und 55.000 Zeichen jeweils direkt an und über der Grenze. Generator- und Pfadangriffe bleiben bis zum nächsten Gate-Schritt offen.

## C. Browser- und Clipboard-Matrix

| Browser | Clipboard | Issue öffnen | Einfügen vollständig | URL unter 1.500 | URL über 1.500 ausgeblendet |
| --- | --- | --- | --- | --- | --- |
| Chrome | offen | offen | offen | offen | offen |
| Edge | offen | offen | offen | offen | offen |
| Firefox | offen | offen | offen | offen | offen |

Bei verweigertem Clipboard-Zugriff muss ein auswählbares Textfeld mit manueller Kopieranleitung erscheinen.

## D. GitHub-Happy-Path

1. Issue-Body enthält lesbare Zusammenfassung und genau einen Payload.
2. Issue wird ohne automatische Schreibaktion geöffnet.
3. Nur ein Maintainer setzt `webui-import`.
4. Workflow liest `GITHUB_EVENT_PATH`.
5. Payload wird dekodiert, validiert und gehasht.
6. Generator erzeugt ausschließlich erwartete Dateien.
7. Python-Validatoren laufen vor dem Commit grün.
8. Branch enthält Issue-Nummer.
9. Pull Request referenziert Issue, Autor und Hash.
10. `validate` erscheint am Pull Request.
11. Falls erforderlich, gibt Maintainer „Approve and run“ frei.
12. `validate` wird grün.
13. Pull Request wäre nach menschlicher Freigabe regulär mergebar.

## E. Idempotenz und Zustände

| Fall | Erwartung |
| --- | --- |
| Gleiches Issue, gleicher Hash | No-op, vorhandenen PR verlinken |
| Gleiches Issue, neuer Hash ohne neue Labelvergabe | keine Verarbeitung |
| Label entfernt und mit neuem Hash erneut gesetzt | kontrollierte Aktualisierung desselben offenen PR |
| Zweites Issue, gleiche Artefakt-ID | Abbruch ohne Commit |
| Artefakt-ID inzwischen auf `main` vorhanden | Abbruch ohne Commit |
| Zugeordneter PR geschlossen | keine automatische Wiederöffnung |
| Zugeordneter PR gemergt | kein Wiederanlauf |
| Parallele Läufe desselben Issues | durch Concurrency serialisiert |

## F. Angriffsmatrix

| Angriff | Erwartung |
| --- | --- |
| `../../.github/workflows/x.yml` | abweisen; kein Commit |
| absoluter Pfad | abweisen; kein Commit |
| `.github/` als Ziel | abweisen; kein Commit |
| Shell-Zeichen im Titel | nur Inhalt; keine Ausführung |
| `${{ ... }}` im Text | nur Inhalt; keine Workflow-Auswertung |
| NUL-/Steuerzeichen | abweisen |
| extrem lange ID | abweisen |
| Slug mit `replace-with` | abweisen |
| Maintainer `pXX` | abweisen |
| manipuliertes `data_risk` | abweisen |
| binärer Inhalt im Payload | abweisen |
| fremde Branch-Zuordnung | nicht verändern |

Jeder Negativfall muss mit verständlichem Issue-Kommentar enden und darf keinen Commit erzeugen.

## G. Repository-Einstellungen

Vor dem Lauf prüfen und protokollieren:

- Defaultbranch des Wegwerf-Repositorys.
- Actions sind aktiviert.
- Workflow darf `contents`, `pull-requests` und `issues` gemäß explizitem `permissions`-Block schreiben.
- Einstellung zum Erstellen von Pull Requests durch Actions.
- Branch-Schutz verlangt `validate` und mindestens eine menschliche Freigabe.
- Force Push und Branch-Löschung sind gesperrt.
- Das Label `webui-import` existiert.

## H. Go/No-Go

### `WEG_A_GO`

Nur wenn alle folgenden Aussagen belegt sind:

- Clipboard-Transport ist vollständig und verständlich.
- Größenlimits greifen vor GitHub.
- Maintainer-Label ist ein wirksames Schreib-Gate.
- Action erzeugt genau einen korrekt zugeordneten PR.
- `validate` läuft und wird grün.
- PR wäre regulär mergebar.
- Angriffe, Kollisionen und Wiederholungen erzeugen keine fremden Änderungen.

### `WEG_A_NO_GO`

Sobald einer dieser Punkte nicht zuverlässig nachweisbar ist. In diesem Fall bleibt `WEG_A_AKTIV = false`; Weg B wird unabhängig fortgesetzt.

## I. Noch zu entscheidende Policy-Frage

Das Repository verlangt große Dateien als GitHub Release Assets. AP14 beschreibt PDF/DOCX zugleich als ZIP-Anhänge für Weg B. Im Gate muss verbindlich festgelegt werden:

- ZIP darf Binärdateien als Übergabepaket enthalten.
- Binärdateien werden nicht automatisch als normale Git-Dateien committed.
- Für große Dateien erzeugt die Anleitung Release-Asset-Metadaten und führt zum Maintainer-Prozess.
- Falls kleine Binärbeispiele im Repository zulässig bleiben, wird dafür eine separate Größen- und Pfadregel dokumentiert.
