# AP14 Browser-Gate

Diese Seite ist ausschließlich der minimale AP14.0-Prüfling für Clipboard- und URL-Transport. Sie ist keine Produktiv-WebUI und veröffentlicht nichts.

Vom Repository-Wurzelverzeichnis aus lokal starten:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Danach `http://127.0.0.1:8765/browser-test/` in Chrome, Edge und Firefox öffnen und die Matrix in `gate-matrix.md` protokollieren. Für jeden der drei Testbeiträge sind zu prüfen:

- angezeigte Messwerte entsprechen `npm run measure`,
- realistische URLs über 1.500 Zeichen werden nicht angeboten,
- der kopierte Issue-Text enthält genau ein vollständiges Markerpaar,
- Umlaute, Emoji, Codefences und mehrzeiliger Text bleiben nach dem Einfügen erhalten,
- bei verweigertem Clipboard-Zugriff wird das Textfeld ausgewählt und die manuelle Anleitung eingeblendet.
