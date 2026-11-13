# FahrtLive – Browser-Testversion

Die Browser-Version zeigt eine iPhone-14-Plus-ähnliche Sperrbildschirm-Vorschau und sucht echte Verbindungen über die kostenlose, **inoffizielle** [DB transport.rest API](https://v6.db.transport.rest/).

## Starten / veröffentlichen

Die Dateien liegen in \`docs/\`. Für GitHub Pages:

1. Öffne **Settings → Pages** des öffentlichen GitHub-Repositories.
2. Wähle unter **Build and deployment** die Source **Deploy from a branch**.
3. Wähle **main** und **/docs**, anschließend **Save**.
4. Danach ist die Website unter \`https://lennard11066-dotcom.github.io/FahrtLive/\` erreichbar, sobald GitHub die Veröffentlichung abgeschlossen hat.

Alternativ lässt sich \`docs/index.html\` im Browser auf dem PC öffnen. Für zuverlässige Netzwerkzugriffe ist GitHub Pages vorzuziehen.

## Funktionsumfang

- Start und Ziel eingeben, Haltestellen finden
- Verbindungen über \`/journeys\` abrufen (bis zu fünf Treffer)
- Verspätung, Ausfall, Ankunft und Etappen soweit verfügbar darstellen
- Eine Verbindung auswählen und die Sperrbildschirm-Vorschau ansehen
- Refresh-Token-Update der ausgewählten Fahrt alle 60 Sekunden **solange der Tab geöffnet/aktiv ist**
- Demo mit erfundenen Fahrtdaten, auch ohne Internet

## Grenzen

- **Keine native iPhone-App:** Live-Aktivität ist nur ein Browser-Mockup.
- **Kein dauerhafter Hintergrundbetrieb:** Browser und Betriebssystem können Updates bei inaktiven Tabs unterbrechen.
- **Keine garantierte Vollständigkeit:** DB transport.rest ist inoffiziell und Daten können vom DB Navigator/RMV abweichen.
- **Rate-Limits:** Bitte nicht ungewöhnlich viele Verbindungen automatisiert abfragen.
- **Keine API-Schlüssel erforderlich.** Alle Anfragen laufen direkt vom Browser zur öffentlichen API.

Die bestehende Swift-App und der GitHub-Actions-iOS-Build bleiben unverändert.
