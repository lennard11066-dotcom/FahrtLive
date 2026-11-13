# FahrtLive – Browser-Testversion

Die Browser-Version zeigt eine iPhone-14-Plus-ähnliche Sperrbildschirm-Vorschau und sucht echte Verbindungen über die kostenlose, von Freiwilligen betriebene [Transitous-API](https://transitous.org/api/).

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
- Reise-ID-Update der ausgewählten Fahrt alle 2 Minuten **solange der Tab geöffnet/aktiv ist**
- Demo mit erfundenen Fahrtdaten, auch ohne Internet

## Grenzen

- **Keine native iPhone-App:** Live-Aktivität ist nur ein Browser-Mockup.
- **Kein dauerhafter Hintergrundbetrieb:** Browser und Betriebssystem können Updates bei inaktiven Tabs unterbrechen.
- **Keine garantierte Vollständigkeit:** Transitous ist keine offizielle DB-API; Abdeckung und Echtzeitdaten können vom DB Navigator/RMV abweichen.
- **Nutzungsregeln:** Transitous erlaubt nichtkommerzielles, ressourcenschonendes Testen. Für dauerhafte Nutzung der Community-API verlangt der Anbieter eine geeignete Open-Source-Lizenz und Quellenangaben. Diese Lizenz muss der Projektinhaber selbst auswählen. Details: https://transitous.org/api/.
- **Keine API-Schlüssel erforderlich.** Alle Anfragen laufen direkt vom Browser zur öffentlichen API.

Die bestehende Swift-App und der GitHub-Actions-iOS-Build bleiben unverändert.

## API-Wechsel

Die zuvor benutzte öffentliche v6.db.transport.rest-API ist laut ihrem Betreiber nicht mehr betriebsfähig. Diese Browser-Testversion nutzt daher die Transitous-MOTIS-API für Haltestellen, Verbindungen und experimentelle Reise-Aktualisierungen. Quellen: https://transitous.org/sources/ . Die Swift-App wurde hier nicht verändert.
