# KItomat AP14 Gate

Temporäres, öffentliches Test-Repository für das technische Go/No-Go-Gate von AP14 (Beitrag vorbereiten).

**Status:** Remote angelegt; AP14.0-Unterlagen lokal vorbereitet; noch kein Workflow- oder Produktivcode.

## Zweck

In diesem Repository wird Weg A isoliert geprüft, ohne das Produktiv-Repository [`ki-tomat/kitomat`](https://github.com/ki-tomat/kitomat) zu verändern:

```text
Payload → Clipboard/Issue → Maintainer-Label → GitHub Action
        → Branch → generierte Dateien → Pull Request → validate
```

## Inhalt

- `payload-contract-v0.md`: minimaler Testvertrag zwischen Browser und Action
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

## Nächster Schritt

Die lokalen Fixtures vermessen und daraus kleine, wegwerfbare Prototypen für Codec, Generator und Import-Workflow ableiten. Produktiver AP14-Code entsteht erst nach bestandenem Gate.
