import SwiftUI
import ActivityKit

@main
struct FahrtLiveApp: App {
    @UIApplicationDelegateAdaptor(FahrtLiveAppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var refreshing = false

    @State private var fromStop = "Kronberg (Taunus)"
    @State private var toStop = "Frankfurt (Main) Hbf"
    @State private var connections: [DBConnection] = []
    @State private var selectedConnection: DBConnection?
    @State private var searching = false

    // Bestehende Demo-Einstellungen bleiben zum Testen erhalten.
    @State private var nextStop = "Frankfurt Hauptwache"
    @State private var delay = 5
    @State private var remaining = 12
    @State private var progress = 0.4
    @State private var status = "Noch nicht gestartet"

    private var liveState: FahrtAttributes.ContentState {
        if let selected = selectedConnection {
            return .init(
                line: selected.line,
                nextStop: selected.nextStop,
                destination: selected.destination,
                remainingMinutes: selected.remainingMinutes,
                delayMinutes: selected.arrivalDelayMinutes ?? 0,
                progress: selected.progress,
                hasRealtimeData: selected.arrivalDelayMinutes != nil
            )
        }

        return .init(
            line: "S8",
            nextStop: nextStop,
            destination: "Frankfurt Hbf",
            remainingMinutes: remaining,
            delayMinutes: delay,
            progress: progress,
            hasRealtimeData: true
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    Image(systemName: "tram.fill")
                        .font(.system(size: 50))
                        .foregroundStyle(.blue)

                    Text(selectedConnection.map { "\($0.line) · \($0.destination)" } ?? "S8 · Demo-Fahrt")
                        .font(.title2.bold())

                    TextField("Start-Haltestelle", text: $fromStop)
                        .textFieldStyle(.roundedBorder)
                    TextField("Ziel-Haltestelle", text: $toStop)
                        .textFieldStyle(.roundedBorder)

                    Button(searching ? "Suche läuft …" : "DB-Verbindungen suchen") {
                        Task { await findConnections() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(searching)

                    if !connections.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Verbindungen")
                                .font(.headline)

                            ForEach(connections) { connection in
                                Button {
                                    selectedConnection = connection
                                    JourneyRefreshStore.save(connection)
                                    status = "Verbindung ausgewählt: \(connection.routeSummary)"
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(connection.routeSummary)
                                                .font(.headline)
                                            Text(
                                                "\(connection.departure.formatted(date: .omitted, time: .shortened)) – \(connection.arrival.formatted(date: .omitted, time: .shortened))"
                                            )
                                            Text(connection.delayText)
                                                .font(.caption)
                                        }
                                        Spacer()
                                        if selectedConnection?.id == connection.id {
                                            Image(systemName: "checkmark.circle.fill")
                                        }
                                    }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }

                    if let selected = selectedConnection {
                        VStack(spacing: 8) {
                            Text("Nächster Halt: \(selected.nextStop)")
                            Text("Ankunft: \(selected.arrival.formatted(date: .omitted, time: .shortened))")
                            Text(selected.delayText)
                            ProgressView(value: selected.progress)
                            Text("Zeitlicher Fortschritt – keine GPS-Position")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Button("Zur Demo wechseln") {
                            selectedConnection = nil
                            JourneyRefreshStore.clear()
                            status = "Demo-Modus ausgewählt"
                        }
                    } else {
                        TextField("Nächster Halt (Demo)", text: $nextStop)
                            .textFieldStyle(.roundedBorder)

                        Stepper(
                            "Verspätung: +\(delay) Min.",
                            value: $delay,
                            in: 0...60
                        )
                        Stepper(
                            "Restzeit: \(remaining) Min.",
                            value: $remaining,
                            in: 0...90
                        )
                        Slider(value: $progress, in: 0...1)
                    }

                    Button("Live-Aktivität starten") {
                        start()
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Live-Aktivität aktualisieren") {
                        Task {
                            for activity in Activity<FahrtAttributes>.activities {
                                await activity.update(
                                    ActivityContent(
                                        state: liveState,
                                        staleDate: nil
                                    )
                                )
                            }
                            status = "Aktualisiert"
                        }
                    }

                    Text(status)
                        .font(.footnote)

                    Text(
                        selectedConnection == nil
                            ? "Demo – keine echten Fahrtdaten"
                            : "Daten: inoffizielle DB transport.rest API. Automatische Prüfung alle 60 Sekunden bei geöffneter App. Hintergrundupdates nur, wenn iOS sie erlaubt."
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .padding()
            }
            .navigationTitle("FahrtLive")
            .onAppear {
                if selectedConnection == nil,
                   let stored = JourneyRefreshStore.load(),
                   stored.arrival > Date() {
                    selectedConnection = stored
                    connections = [stored]
                }
            }
            .task(id: scenePhase) {
                guard scenePhase == .active else { return }
                await refreshSelectedConnection()
                while !Task.isCancelled {
                    do {
                        try await Task.sleep(nanoseconds: 60_000_000_000)
                    } catch {
                        break
                    }
                    guard !Task.isCancelled else { break }
                    await refreshSelectedConnection()
                }
            }
        }
    }

    // iOS stoppt diesen Timer, sobald die App nicht mehr aktiv ist.
    @MainActor
    private func refreshSelectedConnection() async {
        guard !refreshing,
              let current = selectedConnection,
              current.arrival > Date() else { return }

        refreshing = true
        defer { refreshing = false }
        do {
            let updated = try await DBClient.refresh(current)
            guard selectedConnection?.id == current.id else { return }

            selectedConnection = updated
            if let index = connections.firstIndex(where: { $0.id == current.id }) {
                connections[index] = updated
            }
            JourneyRefreshStore.save(updated)
            await JourneyRefreshStore.updateLiveActivity(for: updated)
            status = "Live-Daten aktualisiert: \(Date().formatted(date: .omitted, time: .shortened))"
        } catch {
            status = "Automatisches Update fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func findConnections() async {
        searching = true
        defer { searching = false }
        status = "Verbindungen werden geladen …"

        do {
            let results = try await DBClient.connections(from: fromStop, to: toStop)
            connections = results
            selectedConnection = results.first
            if let first = results.first {
                JourneyRefreshStore.save(first)
            }
            status = "\(results.count) Verbindungen gefunden."
        } catch {
            connections = []
            selectedConnection = nil
            JourneyRefreshStore.clear()
            status = "Fehler: \(error.localizedDescription)"
        }
    }

    private func start() {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            status = "Live-Aktivitäten sind deaktiviert"
            return
        }

        do {
            let content = ActivityContent(
                state: liveState,
                staleDate: nil
            )

            _ = try Activity<FahrtAttributes>.request(
                attributes: FahrtAttributes(
                    reise: selectedConnection.map { "\($0.origin) → \($0.destination)" }
                        ?? "Demo-Fahrt"
                ),
                content: content,
                pushType: nil
            )

            status = "Live-Aktivität gestartet"
        } catch {
            status = "Fehler: \(error.localizedDescription)"
        }
    }
}
