# AP14.0 — Workflow-Vertrag v0

## Zweck und Status

Der Workflow-Prototyp übersetzt genau ein von einem Maintainer gelabeltes GitHub-Issue in einen neuen Artefakt-Branch und einen Pull Request. Der Code ist lokal geprüft; der synthetische Live-Happy-Path wurde am 15. September 2026 im Gate-Repository bestanden. Bis auch die vorgesehenen Negativ-, Kollisions- und Wiederholungsfälle belegt sind, ist dies **kein produktiver Importweg**.

## Auslöser und Vertrauensgrenzen

1. Ausschließlich `issues.labeled` mit dem exakten Label `webui-import` startet den Job.
2. Der Workflow prüft über die GitHub-API, ob der tatsächliche Label-Akteur mindestens `triage` besitzt.
3. Issue-Autor und Label-Akteur stammen aus dem GitHub-Ereignis. Das Payload-Feld `maintainer` bleibt ausdrücklich eine ungeprüfte Selbstauskunft.
4. Der Issue-Body wird nur über `GITHUB_EVENT_PATH` gelesen. Freie Nutzereingaben werden nicht direkt in Workflow-Shellcode eingesetzt.
5. Branch, Pfad, PR-Titel, Risikolabel und Workflow-Ausgaben werden aus validierten Allowlist-Feldern abgeleitet.

## Schreibpfad

```text
Issue + webui-import
  → Berechtigung des Label-Akteurs
  → Payload- und Ereignisvalidierung
  → Generator in prompts/, datasets/ oder models/
  → lokale Validatoren
  → neuer Branch mit Issue-Nummer
  → Commit nur des erzeugten Artefaktverzeichnisses
  → Pull Request mit Herkunft, Hash und offenen Prüfcheckboxen
```

Der Workflow führt keinen Merge, keine Freigabe, keine Checkbox-Bestätigung und keine `Co-authored-by`-Zuschreibung aus.

## Branch- und Wiederholungsregel des Prototyps

Branch-Namen folgen einem festen Muster:

- Prompt: `prompt/<artefakt-id>-i<issue>`
- Dataset: `dataset/<artefakt-id>-i<issue>`
- Branchenmodell: `model/<artefakt-id>-i<issue>`

Existiert remote bereits eine Branch derselben Typ-/ID-Familie, bricht der Prototyp ab. Dadurch sind gleicher Hash, geänderter Hash und ein zweites Issue für dieselbe ID zunächst sicher blockiert. Die in der Gate-Matrix vorgesehene kontrollierte Aktualisierung desselben offenen Pull Requests ist noch nicht implementiert und muss vor einem `WEG_A_GO` separat entwickelt und live getestet werden.

## Validatoren

Vor jedem Commit laufen:

- 64 JavaScript-Tests für Codec, Generator, Importplan, Dateisystem-Vorbereitung und die gemeinsame Validator-Ausführung,
- 5 Python-Tests für den YAML-Fallback und die PII-Heuristik,
- Metadaten-, Vollständigkeits- und PII-Prüfung über alle Artefakte.

Der lokale YAML-Fallback dieses Gates liest die vom Generator verwendeten JSON-quotierten YAML-Skalare verlustfrei. Damit ist insbesondere das bekannte `#`-Problem des derzeitigen Produkt-Validators im Gate behoben; vor einer Produktivübernahme muss dieselbe Korrektur bewusst in `ki-tomat/kitomat` übernommen und geprüft werden.

## Nachgewiesener Live-Happy-Path

Am 15. September 2026 wurde Issue [#1](https://github.com/ki-tomat/kitomat-ap14-gate/issues/1) mit dem synthetischen Prompt-Payload und dem Label `webui-import` verarbeitet. Der Importlauf [#34940100849](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34940100849) erzeugte den Branch `prompt/synthetische-kundenanfrage-sortieren-i1`, sieben Dateien und Pull Request [#2](https://github.com/ki-tomat/kitomat-ap14-gate/pull/2). Der dokumentierte Payload-Hash ist `ccbb17f25365a8f18348677abd60a69af3468ddee2cf2bfcc2e8b0a8e0788907`.

Der `validate`-Lauf [#34940119833](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34940119833) verlangte wegen des erstmalig beitragenden `github-actions[bot]` zunächst die vorgesehene Maintainer-Freigabe und lief danach erfolgreich. Der Branch-Schutz hielt den offenen Pull Request trotz grünem Check ohne die verlangte menschliche Review-Freigabe zurück. Es erfolgte kein Merge.

## Noch offene Live-Voraussetzungen

- Die AP14-Clipboard- und URL-Matrix für Chrome, Edge und Firefox ist noch nicht ausführbar: Der Gate-Prototyp besitzt keine Browser-Testseite; die veröffentlichte WebUI nutzt noch den älteren AP12-Handoff. Chrome und Firefox sind lokal vorhanden, Edge nicht.

- Der erste Wiederholungsfall „gleiches Issue, gleicher Hash“ ist fail-closed belegt: Lauf [#34943076046](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34943076046) erkannte am 15. September 2026 die vorhandene Import-Branch vor Validatoren, Commit und Pull-Request-Erstellung. PR #2 blieb bei einem Commit; ein zusätzlicher Branch oder Pull Request entstand nicht.
- Der Kollisionsfall „zweites Issue, gleiche Artefakt-ID“ ist ebenfalls fail-closed belegt: Issue [#4](https://github.com/ki-tomat/kitomat-ap14-gate/issues/4) und Lauf [#34945425451](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34945425451) erzeugten keinen zusätzlichen Branch, Commit oder Pull Request.
- Der Pfadangriff `../../.github/workflows/x.yml` ist live fail-closed belegt: Issue [#5](https://github.com/ki-tomat/kitomat-ap14-gate/issues/5) und Lauf [#34948664732](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/34948664732) wurden mit `INVALID_ID` bereits in der Importvorbereitung gestoppt; alle Git-Schreibschritte blieben aus.
- Die Manipulation `data_risk: safe` ist live fail-closed belegt: Issue [#6](https://github.com/ki-tomat/kitomat-ap14-gate/issues/6) und Lauf [#35850200817](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/35850200817) wurden mit `INVALID_POLICY_VALUE` in der Importvorbereitung gestoppt; der Remote-Bestand blieb unverändert.
- Der verbotene Maintainer-Platzhalter `pXX` ist live fail-closed belegt: Issue [#7](https://github.com/ki-tomat/kitomat-ap14-gate/issues/7) und Lauf [#35851298845](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/35851298845) wurden mit `INVALID_MAINTAINER` in der Importvorbereitung gestoppt; der Remote-Bestand blieb unverändert.
- Ein dekodiertes NUL-Zeichen in `answers.prompt_text` ist live fail-closed belegt: Issue [#8](https://github.com/ki-tomat/kitomat-ap14-gate/issues/8) und Lauf [#35852077459](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/35852077459) wurden mit `CONTROL_CHARACTER` in der Importvorbereitung gestoppt; der Remote-Bestand blieb unverändert.
- Eine Artefakt-ID mit 81 Zeichen ist live fail-closed belegt: Der vor der Labelvergabe bytegenau verifizierte Payload aus Issue [#11](https://github.com/ki-tomat/kitomat-ap14-gate/issues/11) wurde in Lauf [#35864068815](https://github.com/ki-tomat/kitomat-ap14-gate/actions/runs/35864068815) mit `INVALID_ID` in der Importvorbereitung gestoppt; es entstanden weder Branch noch Commit oder Pull Request.
- Absolute Pfade, `.github` als Ziel, die Platzhalter-ID `replace-with-artifact-id` und ungültige UTF-8-Bytes sind durch Issues #12 bis #15 und die Läufe #35866132367, #35866319625, #35866468365 und #35866602298 live fail-closed belegt.
- Shell- und Workflow-Syntax wurde durch Issue #16 und PR #17 als reiner Dateiinhalt belegt; der Validierungslauf #35866790380 war grün. PR und Branch wurden ohne Merge wieder entfernt.
- Zwei parallele Läufe desselben Issue wurden durch die Läufe #35867407068 und #35867410704 nachweislich serialisiert.
- Eine Änderung des Issue-Payloads ohne neues Labelereignis löste keinen Lauf aus und veränderte PR #2 nicht.
- Ein vorab vorhandener fremder Branch blieb beim Lauf #35898542228 zu Issue #20 unverändert; der Workflow stoppte vor allen Schreibschritten.
- **Offener Befund:** Das erneute Labeln eines bereits geschlossenen Issue erzeugte unerwartet PR #18. Der Workflow muss geschlossene Issues und bereits geschlossene zugeordnete PRs vor dem Schreiben erkennen.
- **Offener Befund:** Das erneute Labeln von Issue #1 mit geändertem Hash aktualisierte den offenen PR #2 nicht, sondern Lauf #35867823054 brach an der vorhandenen Branch-Familie ab. Die im Vertrag geforderte kontrollierte Aktualisierung ist weiterhin nicht implementiert.
- Die Zustände nach regulärem Merge und „Artefakt-ID bereits auf `main`“ können erst nach einem freigegebenen Merge vollständig live geprüft werden.
- Verhalten nach einem Fehler zwischen Branch-Push und PR-Erstellung muss live geprüft werden; der erneute Lauf bleibt bis dahin fail-closed.
- Die Repository-Einstellungen wurden am 23. September 2026 live geprüft: `main` ist geschützt, verlangt `validate` und eine menschliche Freigabe, verbietet Force-Push und Löschen und wendet den Schutz auch auf Administratoren an. GitHub Actions dürfen Pull Requests erstellen; die Token-Standardberechtigung bleibt read-only und wird nur durch den expliziten minimalen `permissions`-Block des Workflows erweitert.
- Die GitHub-Issue-Maske akzeptierte 55.000 Zeichen und wies einen unveröffentlichten Entwurf mit 65.537 Zeichen unter Nennung des effektiven Limits von 65.536 Zeichen zurück.

Fehlgeschlagene Läufe schreiben einen generischen Issue-Kommentar mit Link zum Workflow-Lauf. Details aus Nutzereingaben werden darin nicht wiederholt.
