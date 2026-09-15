# KItomat AP14 Gate

Temporäres, öffentliches Test-Repository für das technische Go/No-Go-Gate von AP14 (Beitrag vorbereiten).

**Status:** AP14.0-Baseline, Codec und Generator veröffentlicht; der synthetische GitHub-Live-Happy-Path und der erste fail-closed Wiederholungstest wurden am 15. September 2026 bestanden; kein Produktivcode.

## Zweck

In diesem Repository wird Weg A isoliert geprüft, ohne das Produktiv-Repository [`ki-tomat/kitomat`](https://github.com/ki-tomat/kitomat) zu verändern:

```text
Payload → Clipboard/Issue → Maintainer-Label → GitHub Action
        → Branch → generierte Dateien → Pull Request → validate
```

## Inhalt

- `payload-contract-v0.md`: minimaler Testvertrag zwischen Browser und Action
- `generator-contract-v0.md`: feste Generatorpfade, Dateilisten und Sicherheitsgrenzen
- `workflow-contract-v0.md`: Trigger, Vertrauensgrenzen, Schreibpfad und offene Live-Gates
- `gate-matrix.md`: Mess-, Browser-, Workflow- und Angriffsmatrix
- `fixtures/prompt.json`: synthetischer Prompt-Beitrag
- `fixtures/dataset.json`: synthetisches Dataset-Paket
- `fixtures/industry.json`: synthetisches Branchenmodell

## Sicherheitsgrenzen

- Ausschließlich synthetische Testdaten.
- Keine Tokens, Secrets oder lokalen Pfade.
- Keine echten Personen-, Kunden-, Gesundheits-, HR- oder Finanzdaten.
- Keine automatische Übernahme binärer Dateien in Git.
- Das Produktiv-Repository bleibt während des Gates unverändert.
- Ein persönliches PAT ist nicht Bestandteil des Pilotversuchs.
- Weg A gilt nur als bestanden, wenn der vorgeschriebene PR-Check `validate` grün ist und der PR regulär mergebar wäre.

## Arbeitsregel

Remote-Pushes, Pull Requests, Freigaben und Merges erfolgen nur nach ausdrücklichem menschlichem Go.

## Lokale Prüfung

Voraussetzung ist Node.js 20 oder neuer. Der Prototyp verwendet keine externen Laufzeit-Abhängigkeiten.

```bash
npm test
python3 -m unittest discover -s tools/validators -p 'test_*.py' -v
python3 tools/validators/validate_metadata.py
python3 tools/validators/validate_completeness.py
python3 tools/validators/pii_heuristic.py
npm run measure
npm run generate:fixture -- --fixture prompt --repository-root /tmp/kitomat-ap14-test
```

Der Codec validiert die feste Payload-Hülle, die typspezifischen Feldlisten, Datentypen, Bestätigungen, Marker, Base64, UTF-8 und die vorläufige 32-KiB-Grenze. SHA-256 wird über die exakt dekodierten Payload-Bytes berechnet. Der Generator erzeugt anschließend ausschließlich allowlist-basierte KItomat-Pflichtdateien und einen deterministischen Manifest-Hash. Der lokale Stand umfasst 64 JavaScript- und 5 Python-Tests.

## Nächster Schritt

Nach dem bestandenen synthetischen Live-Happy-Path und dem ersten fail-closed Wiederholungstest folgen die weiteren dokumentierten Negativ-, Kollisions- und Wiederholungsfälle. Wiederholungen bleiben zunächst fail-closed. Vor der späteren Produktivübernahme muss außerdem der dokumentierte quote-unsichere YAML-Fallback im Produkt-Repository korrigiert werden. Produktiver AP14-Code entsteht erst nach bestandenem vollständigem Gate.
