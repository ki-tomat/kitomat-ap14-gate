# AP14.0 — Minimaler Payload-Testvertrag v0

Dieser Vertrag dient ausschließlich dem Gate-Prototyp. Er wird nach den Messungen als Grundlage für AP14.1 bestätigt oder angepasst.

## Transport

```text
<!-- kitomat:payload:v1 -->
<UTF-8-JSON als Base64 ohne Zeilenumbruch>
<!-- /kitomat:payload -->
```

Der Issue-Body enthält vor dem Payload eine kurze lesbare Zusammenfassung. Der Parser akzeptiert genau ein vollständiges Markerpaar.

## Top-Level-Objekt

```json
{
  "v": 1,
  "type": "prompt | dataset | industry",
  "role": "course | external",
  "answers": {},
  "acknowledgements": {
    "public_content_confirmed": true,
    "no_real_personal_data_confirmed": true,
    "pii_hints_reviewed": true
  }
}
```

Unbekannte Top-Level-Felder werden abgewiesen. `answers` wird je Typ gegen eine feste Feldliste geprüft.

## Gemeinsame Antworten

- `id`
- `title`
- `category`
- `language`
- `maintainer`
- `license`
- `license_status`
- `data_risk`
- `ai_act_proximity`
- `sources_status`
- `scenario_positive`
- `scenario_rework`
- `scenario_negative`
- `failure_modes`

Der Generator ergänzt deterministisch:

- `artifact_type`
- `status: draft`
- `version: "0.1.0"`
- `human_review_required: true`
- den typspezifischen `legal_disclaimer`

## Typspezifische Antworten

### Prompt

- `target_users`
- `use_case`
- `required_inputs`
- `output_format`
- `personal_data_possible`
- `evaluation_criteria`
- `prompt_text`
- `sample_input`
- `sample_output`
- `sources`

### Dataset

- `linked_artifacts`
- `data_origin`
- `contains_personal_data`
- `contains_sensitive_data`
- `sources_date`
- `usage_scope`
- `release_asset_required`
- `release_asset_name`
- `release_asset_version`
- `release_asset_size_mb`
- `release_asset_sha256`
- `release_asset_url`
- `dataset_description`
- `sources`

### Branchenmodell

- `model_type`
- `target_users`
- `use_case`
- `required_inputs`
- `output_format`
- `application_scope`
- `framework_references`
- `required_review_level`
- `model_description`
- `application_guide`
- `sample_case`
- `sources`

## Vorläufige Grenzen

| Gegenstand | Grenze |
| --- | ---: |
| UTF-8-JSON des gesamten Payloads | 32 KiB |
| Lesbare Issue-Zusammenfassung | 8.000 Zeichen |
| Gesamter Issue-Body | 55.000 Zeichen |
| Vollständige Pre-fill-URL | 1.500 Zeichen |

Die Gate-Messung bestätigt oder reduziert diese Grenzen. Eine Erhöhung erfordert dokumentierten Nachweis.

## Kodierung

- JSON wird deterministisch serialisiert.
- Base64 entsteht aus UTF-8-Bytes, nicht direkt aus JavaScript-UTF-16-Strings.
- Umlaute, Emoji, Codefences, Backticks, CRLF und LF müssen verlustfrei bleiben.
- Dekodierte Daten werden vor jeder Dateierzeugung streng validiert.

## Nicht im Issue-Payload

- PDF- oder DOCX-Bytes
- lokale Dateipfade
- Browser-Metadaten
- Tokens, Cookies oder Zugangsdaten
- beliebige Zieldateipfade

## Hash und Freigabe

Die Action berechnet SHA-256 über die exakt dekodierten Payload-Bytes des `labeled`-Ereignisses. Der Hash wird mit Issue und Pull Request dokumentiert. Nachträgliche Änderungen erfordern Entfernen und erneutes Setzen des Labels.
