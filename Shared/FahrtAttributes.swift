
import ActivityKit
import Foundation

struct FahrtAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var line: String
        var nextStop: String
        var destination: String
        var remainingMinutes: Int
        var delayMinutes: Int
        var progress: Double
    }

    var reise: String
}
