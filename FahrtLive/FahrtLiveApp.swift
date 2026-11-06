
import SwiftUI
import ActivityKit

@main
struct FahrtLiveApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @State private var nextStop = "Frankfurt Hauptwache"
    @State private var delay = 5
    @State private var remaining = 12
    @State private var progress = 0.4
    @State private var status = "Noch nicht gestartet"

    private var liveState: FahrtAttributes.ContentState {
        .init(
            line: "S8",
            nextStop: nextStop,
            destination: "Frankfurt Hbf",
            remainingMinutes: remaining,
            delayMinutes: delay,
            progress: progress
        )
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: "tram.fill")
                    .font(.system(size: 50))
                    .foregroundStyle(.blue)

                Text("S8 · Demo-Fahrt")
                    .font(.title2.bold())

                TextField("Nächster Halt", text: $nextStop)
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

                Text("Demo – keine echten RMV-Daten")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .navigationTitle("FahrtLive")
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
                attributes: FahrtAttributes(reise: "Demo-Fahrt"),
                content: content,
                pushType: nil
            )

            status = "Live-Aktivität gestartet"
        } catch {
            status = "Fehler: \(error.localizedDescription)"
        }
    }
}
