# Prompt-Paket: $(touch owned) ${{ github.token }}; `uname`

## Zweck

Frei erfundene Kundenanfragen nach Thema und Dringlichkeit vorsortieren, ohne Entscheidungen über reale Personen zu treffen.

## Zielgruppe

- Mitarbeitende kleiner Serviceteams ohne Programmierkenntnisse

## Szenario-Triade

### Positiv

Positiv: Die Anfrage enthält eine klare synthetische Fehlermeldung und erlaubte Kategorien. Die Ausgabe ist nachvollziehbar und als Vorschlag markiert.

### Nachbearbeitbar

Nachbearbeitbar: Die Anfrage nennt keine Auswirkungen. Das System kennzeichnet Unsicherheit und verlangt eine Rückfrage, statt Dringlichkeit zu erfinden.

### Negativ

Negativ: Eine Anfrage enthält echte Kunden- oder Kontaktdaten. Der Prompt darf dafür nicht verwendet werden; der Inhalt muss vorab entfernt oder synthetisch ersetzt werden.

## Trust-Hinweis

Entwurf mit verpflichtender menschlicher Prüfung; keine automatische fachliche Freigabe.
