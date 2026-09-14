# AP14.0 — Generator-Testvertrag v0

## Zweck

Der Generator-Prototyp übersetzt ausschließlich einen bereits durch den Payload-Codec geprüften Beitrag in eine feste KItomat-Artefaktstruktur. Er erzeugt Dateien lokal; er führt weder Git-Befehle noch GitHub-Schreibaktionen aus.

## Feste Zielzuordnung

| Payload-Typ | Zielwurzel | `artifact_type` |
| --- | --- | --- |
| `prompt` | `prompts/<id>/` | `prompt_package` |
| `dataset` | `datasets/<id>/` | `dataset_package` |
| `industry` | `models/<id>/` | `model` |

Die Artefakt-ID ist der einzige Payload-Wert, der in einen Pfad eingeht. Sie muss ein kleingeschriebener Slug aus Buchstaben, Ziffern und einzelnen Bindestrichen mit höchstens 80 Zeichen sein. Absolute Pfade, Punkte, Schrägstriche, Steuerzeichen und `replace-with` sind unzulässig.

## Erzeugte Pflichtdateien

### Prompt-Paket

```text
README.md
metadata.yml
prompt.md
evaluation.md
failure-modes.md
examples/input-01.md
examples/output-01.md
```

### Dataset-Paket

```text
README.md
metadata.yml
sources.md
license.md
usage.md
```

### Branchenmodell

```text
README.md
metadata.yml
model.md
application-guide.md
failure-modes.md
sources.md
examples/example-01.md
```

## Deterministische Ergänzungen

Der Generator setzt unveränderlich:

- `status: draft`
- `version: "0.1.0"`
- `human_review_required: true`
- den zum Artefakttyp gehörenden rechtlichen Hinweis

Metadatenfelder und Dateilisten haben eine feste Reihenfolge. Quellenobjekte werden nach Schlüsseln sortiert. Sämtliche Textausgaben werden auf LF-Zeilenenden normalisiert. `buildFiles(payload)` liefert ausschließlich Objekte der Form `{ path, content, binary: false }`. Ein SHA-256-Manifest umfasst vollständige Repository-Pfade und UTF-8-Inhalte. Gleicher gültiger Payload erzeugt dadurch bytegenau gleiche Dateien und denselben Manifest-Hash.

## Schreib- und Kollisionsschutz

- Der Generator kennt nur die drei Zielwurzeln `prompts`, `datasets` und `models`.
- Symbolische Links als Zielwurzel werden abgewiesen.
- Eine bereits in einer der drei Zielwurzeln vorhandene Artefakt-ID blockiert die Generierung global.
- Gleichzeitige Läufe derselben ID dürfen genau ein Artefakt erzeugen.
- Dateien werden zunächst in einem neu angelegten temporären Unterverzeichnis geschrieben und anschließend in das endgültige Verzeichnis verschoben.
- Fehlerhafte oder unvollständige temporäre Ausgaben werden entfernt.
- Shell- und GitHub-Workflow-Zeichen bleiben reiner Dateiinhalt und werden niemals ausgeführt.
- Binärdateien, beliebige Zielpfade, Commits, Branches und Pull Requests gehören nicht zum Generator.

## Lokaler Prüfstand

Stand: 14. September 2026

- Gesamtsuite Codec und Generator: 50/50 Tests bestanden.
- KItomat-Metadatenvalidator: 3/3 generierte Artefakte bestanden.
- KItomat-Vollständigkeitsvalidator: 3/3 generierte Artefakte bestanden.
- PII-Heuristik: ein dokumentierter Fehlalarm für das synthetische Datum `2026-09-14`; keine erkannten E-Mail-, IBAN- oder Steuer-ID-Muster.

## Bekannte Kompatibilitätslücke vor Produktivübernahme

PyYAML liest die Generatorausgabe auch mit `#`, Doppelpunkten, Quotes, Umlauten, mehrzeiligen Werten, Listen, Booleans und Leerstrings korrekt. Der derzeitige einfache YAML-Fallback in `ki-tomat/kitomat/tools/validators/validate_metadata.py` trennt dagegen `#` auch innerhalb korrekt zitierter Strings als Kommentar ab. Das bestätigt die in AP14.2 beschriebene notwendige quote-sichere Korrektur. Die Lücke blockiert nicht den isolierten Generator-Prototyp, aber seine Übernahme in den Produktivcode.

Der Vertrag ist erst nach dem späteren GitHub-Happy-Path-Gate eine Grundlage für Produktivcode.
