# KItomat AP14 Gate

Temporäres, öffentliches Test-Repository für das technische Go/No-Go-Gate von AP14 (Beitrag vorbereiten).

**Status:** AP14.0-Baseline veröffentlicht; lokales Codec- und Mess-Gate bestanden; noch kein GitHub-Workflow oder Produktivcode.

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

## Lokale Prüfung

Voraussetzung ist Node.js 20 oder neuer. Der Prototyp verwendet keine externen Laufzeit-Abhängigkeiten.

```bash
npm test
npm run measure
```

Der Codec validiert die feste Payload-Hülle, die typspezifischen Feldlisten, Datentypen, Bestätigungen, Marker, Base64, UTF-8 und die vorläufige 32-KiB-Grenze. SHA-256 wird über die exakt dekodierten Payload-Bytes berechnet.

## Nächster Schritt

Nach bestandenem lokalen Codec-Gate folgt ein wegwerfbarer Generator-Prototyp. Ein GitHub-Import-Workflow und produktiver AP14-Code entstehen erst in späteren, separat freigegebenen Schritten.
