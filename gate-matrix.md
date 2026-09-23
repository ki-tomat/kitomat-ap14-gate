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

Lokaler Prüfstand vom 14. September 2026: **24/24 automatisierte Codec-Tests bestanden**. Abgedeckt sind die drei Fixture-Roundtrips, Unicode und Zeilenenden, kurze und zu lange Pre-fill-URLs, Marker-, Base64-, UTF-8-, JSON-, Versions-, Feld-, Typ- und Bestätigungsfehler sowie die Grenzwerte 32 KiB und 55.000 Zeichen jeweils direkt an und über der Grenze. Generator- und Pfadangriffe werden in Abschnitt F behandelt; der erste Live-Pfadangriff ist dort inzwischen fail-closed belegt.

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

**Live-Ergebnis vom 15. September 2026: bestanden.** Das öffentliche synthetische Issue [#1](https://github.com/ki-tomat/kitomat-ap14-gate/issues/1) wurde von `@solvity` mit `webui-import` gelabelt. Der Importlauf [#34940100849](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34940100849) war nach 17 Sekunden erfolgreich und erzeugte:

- Branch `prompt/synthetische-kundenanfrage-sortieren-i1`,
- Commit `dc820e499945e2c30d5576f5210b512a3cb283e4`,
- exakt sieben Dateien unter `prompts/synthetische-kundenanfrage-sortieren/`,
- Pull Request [#2](https://github.com/ki-tomat/kitomat-ap14-gate/pull/2) mit `artifact`, `needs-review` und `risk_green`,
- die Rückverknüpfung und den vorgesehenen Kommentar im Issue,
- den korrekten Payload-Hash `ccbb17f25365a8f18348677abd60a69af3468ddee2cf2bfcc2e8b0a8e0788907`.

GitHub hielt den ersten `validate`-Lauf für den erstmalig beitragenden `github-actions[bot]` zunächst mit `Action required` zurück. Nach der vorgesehenen Maintainer-Freigabe lief [Validate #34940119833](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34940119833) in 16 Sekunden erfolgreich. Der Pull Request blieb anschließend erwartungsgemäß `Awaiting approval`, weil mindestens eine menschliche Review-Freigabe fehlt. Es wurde nichts gemergt.

## E. Idempotenz und Zustände

Die folgenden Erwartungen beschreiben das Zielverhalten für ein späteres `WEG_A_GO`. Der aktuelle Prototyp blockiert Wiederholungen und ID-Kollisionen zunächst bewusst fail-closed, sobald bereits eine Import-Branch derselben Typ-/ID-Familie vorhanden ist.

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

**Live-Ergebnis des ersten Wiederholungstests vom 15. September 2026: fail-closed bestanden.** Am unveränderten synthetischen Issue [#1](https://github.com/ki-tomat/kitomat-ap14-gate/issues/1) wurde das Label `webui-import` entfernt und bei identischem Payload sowie identischem Hash erneut gesetzt. Der zweite Importlauf [#34943076046](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34943076046) stoppte erwartungsgemäß im Schritt „Vorhandene Import-Branch-Familie ausschließen“ mit dem Hinweis, dass für diese Artefakt-ID bereits eine Import-Branch existiert.

Die nachfolgenden Schritte für Validatoren, Commit, Pull-Request-Erstellung und Issue-Verknüpfung wurden übersprungen. Der Workflow hinterließ im Issue ausschließlich den generischen sicheren Abbruchkommentar mit Lauf-Link. Es entstand kein zusätzlicher Branch, Commit oder Pull Request: Pull Request [#2](https://github.com/ki-tomat/kitomat-ap14-gate/pull/2) enthielt danach weiterhin genau den ursprünglichen Commit `dc820e499945e2c30d5576f5210b512a3cb283e4`; im Repository blieben insgesamt die zwei bereits vorhandenen offenen Pull Requests #2 und #3 bestehen.

**Live-Ergebnis des ID-Kollisionstests vom 15. September 2026: fail-closed bestanden.** Das neue synthetische Issue [#4](https://github.com/ki-tomat/kitomat-ap14-gate/issues/4) enthielt denselben Prompt-Payload, dieselbe Artefakt-ID `synthetische-kundenanfrage-sortieren` und denselben Payload-Hash wie Issue #1. Nach der Maintainer-Labelvergabe stoppte Lauf [#34945425451](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34945425451) nach 13 Sekunden ebenfalls im Schritt „Vorhandene Import-Branch-Familie ausschließen“ mit der Meldung `Import abgebrochen: Für diese Artefakt-ID existiert bereits eine Import-Branch.`

Die nachfolgenden Validator-, Commit-, Pull-Request- und Issue-Verknüpfungsschritte wurden übersprungen; der sichere Standardkommentar verlinkte den Lauf in Issue #4. Der Remote-Bestand blieb bei genau drei Branches (`main`, `docs/ap14-live-happy-path` und `prompt/synthetische-kundenanfrage-sortieren-i1`) sowie zwei offenen Pull Requests. Insbesondere entstand keine Branch mit Issue-Nummer 4, und Pull Request #2 enthielt weiterhin nur Commit `dc820e499945e2c30d5576f5210b512a3cb283e4`.

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

**Live-Ergebnis des Pfadangriffstests vom 15. September 2026: fail-closed bestanden.** Das synthetische Issue [#5](https://github.com/ki-tomat/kitomat-ap14-gate/issues/5) enthielt im Payload die manipulierte Artefakt-ID `../../.github/workflows/x.yml` mit dem Payload-Hash `9d4c58bf1c51e63ce6f9d469ce6e139f5f531ab0d39de1c037481b69320a2623`. Lauf [#34948664732](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34948664732) stoppte nach 11 Sekunden im Schritt „Import sicher vorbereiten“ mit `INVALID_ID: Artefakt-ID muss ein kleingeschriebener, maximal 80 Zeichen langer Slug sein.`

Alle folgenden Schritte für Branch-Familienprüfung, Validatoren, Commit, Pull-Request-Erstellung und Issue-Verknüpfung wurden übersprungen. Issue #5 erhielt ausschließlich den generischen sicheren Abbruchkommentar mit Lauf-Link. Der Remote-Bestand blieb bei den drei bekannten Branches, zwei offenen Pull Requests und dem unveränderten Einzelcommit `dc820e499945e2c30d5576f5210b512a3cb283e4` in Pull Request #2; insbesondere wurde weder unter `.github/` noch an einem anderen Ziel geschrieben.

**Live-Ergebnis des `data_risk`-Manipulationstests vom 23. September 2026: fail-closed bestanden.** Das synthetische Issue [#6](https://github.com/ki-tomat/kitomat-ap14-gate/issues/6) verwendete die neue gültige Artefakt-ID `data-risk-manipulation-test`, setzte aber `data_risk` auf den unerlaubten Wert `safe`. Der Payload-Hash lautete `f24d3fe139e31bbda669d7c8d7fea1dcd92c36c47292b5811bfc0d3f7cd3cba7`. Lauf [#35850200817](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/35850200817) stoppte nach 12 Sekunden im Schritt „Import sicher vorbereiten“ mit `INVALID_POLICY_VALUE: data_risk enthält keinen erlaubten Wert.`

Alle nachfolgenden Schritte wurden übersprungen, und Issue #6 erhielt den generischen sicheren Abbruchkommentar mit Lauf-Link. Der Remote-Bestand blieb unverändert bei drei Branches und zwei offenen Pull Requests; Pull Request #2 enthielt weiterhin ausschließlich Commit `dc820e499945e2c30d5576f5210b512a3cb283e4`.

**Live-Ergebnis des Maintainer-Policytests vom 23. September 2026: fail-closed bestanden.** Das synthetische Issue [#7](https://github.com/ki-tomat/kitomat-ap14-gate/issues/7) verwendete die neue gültige Artefakt-ID `maintainer-placeholder-test`, setzte den Maintainer aber auf den verbotenen Template-Platzhalter `pXX`. Der Payload-Hash lautete `4dca73383c8bf0726ba975c9fe5942317f241581d9dca355e1916e1a514a5f89`. Lauf [#35851298845](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/35851298845) stoppte nach 18 Sekunden im Schritt „Import sicher vorbereiten“ mit `INVALID_MAINTAINER: Maintainer ist ungültig oder noch ein Template-Platzhalter.`

Alle nachfolgenden Schritte wurden übersprungen, und Issue #7 erhielt den generischen sicheren Abbruchkommentar mit Lauf-Link. Der Remote-Bestand blieb unverändert bei drei Branches und zwei offenen Pull Requests; Pull Request #2 enthielt weiterhin ausschließlich Commit `dc820e499945e2c30d5576f5210b512a3cb283e4`.

**Live-Ergebnis des Steuerzeichen-Tests vom 23. September 2026: fail-closed bestanden.** Das synthetische Issue [#8](https://github.com/ki-tomat/kitomat-ap14-gate/issues/8) verwendete die neue gültige Artefakt-ID `control-character-test` und enthielt nach dem Dekodieren genau ein NUL-Zeichen in `answers.prompt_text`. Der Payload-Hash lautete `0c82a5914e68e4cecd19eb3d6cdbeb646bdcadae2f6f94c75e114cd80e5e705a`. Lauf [#35852077459](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/35852077459) stoppte im Schritt „Import sicher vorbereiten“ mit `CONTROL_CHARACTER: payload.answers.prompt_text enthält ein unzulässiges Steuerzeichen.`

Alle nachfolgenden Schritte wurden übersprungen, und Issue #8 erhielt den generischen sicheren Abbruchkommentar mit Lauf-Link. Der Remote-Bestand blieb unverändert bei drei Branches und zwei offenen Pull Requests; Pull Request #2 enthielt weiterhin ausschließlich Commit `dc820e499945e2c30d5576f5210b512a3cb283e4`.

**Live-Ergebnis des Tests einer überlangen Artefakt-ID vom 23. September 2026: fail-closed bestanden.** Der Payload des synthetischen Issue [#11](https://github.com/ki-tomat/kitomat-ap14-gate/issues/11) wurde vor der Labelvergabe aus GitHub zurückgelesen und bytegenau verifiziert: `answers.id` enthielt 81 Zeichen, der Payload umfasste 868 Bytes und hatte den SHA-256-Hash `3f45f20538418b462d537464f8cdb2a5e64af11a82d16916aff35538ad4ba700`. Lauf [#35864068815](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/35864068815) stoppte nach 10 Sekunden im Schritt „Import sicher vorbereiten“ mit `INVALID_ID: Artefakt-ID muss ein kleingeschriebener, maximal 80 Zeichen langer Slug sein.` Alle nachfolgenden Schreibschritte wurden übersprungen, Issue #11 erhielt den generischen sicheren Abbruchkommentar, und der Remote-Bestand blieb bei den drei erwarteten Branches und den offenen Pull Requests #2 und #3.

Ein vorheriger Aufbau in Issue [#9](https://github.com/ki-tomat/kitomat-ap14-gate/issues/9) wird nicht als Negativtest gewertet: Durch einen Übertragungsfehler enthielt der veröffentlichte Payload nur 78 statt 81 Zeichen und war daher gültig. Der dadurch erzeugte Pull Request [#10](https://github.com/ki-tomat/kitomat-ap14-gate/pull/10) wurde mit erklärendem Hinweis ohne Merge geschlossen, sein Branch gelöscht, das Auslöselabel entfernt und Issue #9 geschlossen. `main`, Pull Request #2 und Pull Request #3 blieben unverändert.

Lokaler Workflow-Prüfstand vom 14. September 2026: 64/64 JavaScript- und 5/5 Python-Tests bestanden. Pfad-Traversal, absolute Pfade, `.github` als Ziel, überlange und platzhalterhaltige IDs, `pXX`, manipuliertes `data_risk`, Steuerzeichen, symbolische Zielwurzeln sowie globale und parallele ID-Kollisionen werden abgewiesen. Shell-Zeichen und `${{ ... }}` bleiben reiner Dateiinhalt. Die drei Fixture-Ausgaben umfassen exakt 7/5/7 Dateien, sind bytegenau deterministisch, verwenden ausschließlich LF und bestehen gemeinsam die Validatoren für Metadaten, Vollständigkeit und PII-Hinweise. Importplan und Dateisystem-Vorbereitung sind lokal geprüft; Workflow-Kommentare, GitHub-Berechtigungen, Branch-Push und Pull-Request-Zuordnung bleiben bis zum Live-Gate offen.

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
