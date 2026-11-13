import Foundation
import ActivityKit
import BackgroundTasks
import UIKit

// Speichert die aktive Fahrt, damit eine gelegentliche iOS-Hintergrundausführung
// dieselbe Fahrt (inklusive Refresh-Token) aktualisieren kann.
enum JourneyRefreshStore {
    private static let key = "FahrtLive.selectedJourney"

    static func save(_ connection: DBConnection) {
        guard let data = try? JSONEncoder().encode(connection) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func load() -> DBConnection? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(DBConnection.self, from: data)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: FahrtLiveAppDelegate.refreshIdentifier)
    }

    static func updateLiveActivity(for connection: DBConnection) async {
        let content = FahrtAttributes.ContentState(
            line: connection.line,
            nextStop: connection.nextStop,
            destination: connection.destination,
            remainingMinutes: connection.remainingMinutes,
            delayMinutes: connection.arrivalDelayMinutes ?? 0,
            progress: connection.progress,
            hasRealtimeData: connection.arrivalDelayMinutes != nil
        )

        for activity in Activity<FahrtAttributes>.activities {
            await activity.update(
                ActivityContent(state: content, staleDate: Date(timeIntervalSinceNow: 120))
            )
        }
    }

    static func refreshInBackground() async throws {
        guard let current = load(), current.arrival > Date() else { return }
        guard !Activity<FahrtAttributes>.activities.isEmpty else { return }
        let refreshed = try await DBClient.refresh(current)
        save(refreshed)
        await updateLiveActivity(for: refreshed)
    }
}

// BGAppRefresh ist eine Best-Effort-Anfrage. iOS legt selbst fest,
// ob und wann die App geweckt wird. Kein 60-Sekunden-Intervall bei Sperre.
final class FahrtLiveAppDelegate: NSObject, UIApplicationDelegate {
    static let refreshIdentifier = "com.fahrtlive.personal.refresh"

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.refreshIdentifier,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            Self.scheduleRefresh()

            let work = Task {
                do {
                    try await JourneyRefreshStore.refreshInBackground()
                    refreshTask.setTaskCompleted(success: true)
                } catch {
                    refreshTask.setTaskCompleted(success: false)
                }
            }
            refreshTask.expirationHandler = {
                work.cancel()
            }
        }
        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        Self.scheduleRefresh()
    }

    static func scheduleRefresh() {
        guard let current = JourneyRefreshStore.load(),
              current.arrival > Date(),
              !Activity<FahrtAttributes>.activities.isEmpty else { return }

        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: refreshIdentifier)
        let request = BGAppRefreshTaskRequest(identifier: refreshIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
}
