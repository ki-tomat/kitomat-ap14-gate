# AP14.0 — Workflow-Vertrag v0

## Zweck und Status

Der Workflow-Prototyp übersetzt genau ein von einem Maintainer gelabeltes GitHub-Issue in einen neuen Artefakt-Branch und einen Pull Request. Der Code ist lokal geprüft, aber noch nicht im GitHub-Repository ausgeführt. Bis der Live-Happy-Path und die Negativfälle belegt sind, ist dies **kein produktiver Importweg**.

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

## Noch offene Live-Voraussetzungen

- GitHub Actions müssen aktiviert sein.
- Actions müssen Pull Requests erstellen dürfen.
- Die Labels `webui-import`, `artifact`, `needs-review`, `risk_green`, `risk_yellow` und `risk_red` müssen existieren.
- Der Branch-Schutz für `main` muss den Check `validate` und mindestens eine menschliche Freigabe verlangen.
- Der erste synthetische Happy-Path und die vorgesehenen Negativfälle müssen protokolliert werden.
- Verhalten nach einem Fehler zwischen Branch-Push und PR-Erstellung muss live geprüft werden; der erneute Lauf bleibt bis dahin fail-closed.

Fehlgeschlagene Läufe schreiben einen generischen Issue-Kommentar mit Link zum Workflow-Lauf. Details aus Nutzereingaben werden darin nicht wiederholt.
