import Foundation

// Inoffizielle, kostenlos nutzbare DB-Datenschnittstelle:
// https://v6.db.transport.rest/
// Die API ist nicht Teil von Deutsche Bahn und benötigt keinen API-Schlüssel.
struct DBConnection: Identifiable {
    let id = UUID()
    let line: String
    let nextStop: String
    let origin: String
    let destination: String
    let departure: Date
    let arrival: Date
    let arrivalDelayMinutes: Int?
    let routeSummary: String

    var remainingMinutes: Int {
        max(0, Int(ceil(arrival.timeIntervalSinceNow / 60)))
    }

    // Zeitbasierter Fortschritt; keine GPS-Ortung des Zuges.
    var progress: Double {
        let total = arrival.timeIntervalSince(departure)
        guard total > 0 else { return 0 }
        return min(1, max(0, Date().timeIntervalSince(departure) / total))
    }

    var delayText: String {
        guard let delay = arrivalDelayMinutes else { return "Keine Echtzeitangabe" }
        if delay > 0 { return "+\(delay) Min. Verspätung" }
        if delay < 0 { return "\(abs(delay)) Min. früher" }
        return "Pünktlich (Echtzeit)"
    }
}

enum DBAPIError: LocalizedError {
    case invalidURL
    case http(Int)
    case missingStop(String)
    case noJourneys
    case invalidData

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Die API-Adresse ist ungültig."
        case .http(let status):
            return status == 429
                ? "Zu viele Anfragen. Bitte später erneut versuchen."
                : "DB-API momentan nicht erreichbar (HTTP \(status))."
        case .missingStop(let query):
            return "Haltestelle nicht gefunden: \(query)"
        case .noJourneys:
            return "Für diese Strecke wurden keine Verbindungen gefunden."
        case .invalidData:
            return "Die DB-Antwort konnte nicht verarbeitet werden."
        }
    }
}

private struct DBPlace: Decodable {
    let id: String?
    let name: String?
}

private struct DBLine: Decodable {
    let name: String?
}

private struct DBStopover: Decodable {
    let stop: DBPlace?
    let arrival: String?
    let departure: String?
}

private struct DBLeg: Decodable {
    let origin: DBPlace?
    let destination: DBPlace?
    let departure: String?
    let plannedDeparture: String?
    let arrival: String?
    let plannedArrival: String?
    let arrivalDelay: Double?
    let walking: Bool?
    let line: DBLine?
    let stopovers: [DBStopover]?
}

private struct DBJourney: Decodable {
    let legs: [DBLeg]
}

private struct DBJourneysResponse: Decodable {
    let journeys: [DBJourney]
}

enum DBClient {
    private static let baseURL = "https://v6.db.transport.rest"

    static func connections(from start: String, to end: String) async throws -> [DBConnection] {
        let fromQuery = start.trimmingCharacters(in: .whitespacesAndNewlines)
        let toQuery = end.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !fromQuery.isEmpty else { throw DBAPIError.missingStop("Start") }
        guard !toQuery.isEmpty else { throw DBAPIError.missingStop("Ziel") }

        async let fromStop = findStop(fromQuery)
        async let toStop = findStop(toQuery)
        let (origin, destination) = try await (fromStop, toStop)

        guard let originID = origin.id, let destinationID = destination.id else {
            throw DBAPIError.invalidData
        }

        let result: DBJourneysResponse = try await request(
            "journeys",
            parameters: [
                URLQueryItem(name: "from", value: originID),
                URLQueryItem(name: "to", value: destinationID),
                URLQueryItem(name: "results", value: "5"),
                URLQueryItem(name: "stopovers", value: "true"),
                URLQueryItem(name: "language", value: "de")
            ]
        )

        let journeys = result.journeys.compactMap {
            parseJourney(
                $0,
                origin: origin.name ?? fromQuery,
                destination: destination.name ?? toQuery
            )
        }
        guard !journeys.isEmpty else { throw DBAPIError.noJourneys }
        return journeys
    }

    private static func findStop(_ query: String) async throws -> DBPlace {
        let stops: [DBPlace] = try await request(
            "locations",
            parameters: [
                URLQueryItem(name: "query", value: query),
                URLQueryItem(name: "results", value: "8"),
                URLQueryItem(name: "stops", value: "true"),
                URLQueryItem(name: "addresses", value: "false"),
                URLQueryItem(name: "poi", value: "false"),
                URLQueryItem(name: "language", value: "de")
            ]
        )
        guard let stop = stops.first(where: { $0.id != nil && $0.name != nil }) else {
            throw DBAPIError.missingStop(query)
        }
        return stop
    }

    private static func request<T: Decodable>(
        _ endpoint: String,
        parameters: [URLQueryItem]
    ) async throws -> T {
        guard var components = URLComponents(string: "\(baseURL)/\(endpoint)") else {
            throw DBAPIError.invalidURL
        }
        components.queryItems = parameters
        guard let url = components.url else {
            throw DBAPIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.timeoutInterval = 25
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw DBAPIError.invalidData
        }
        guard (200...299).contains(http.statusCode) else {
            throw DBAPIError.http(http.statusCode)
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw DBAPIError.invalidData
        }
    }

    private static func parseJourney(
        _ journey: DBJourney,
        origin: String,
        destination: String
    ) -> DBConnection? {
        guard let first = journey.legs.first,
              let last = journey.legs.last,
              let departure = parseDate(first.departure ?? first.plannedDeparture),
              let arrival = parseDate(last.arrival ?? last.plannedArrival)
        else { return nil }

        let firstRide = journey.legs.first(where: { $0.walking != true && $0.line != nil })
        let line = firstRide?.line?.name ?? "Fußweg"

        let now = Date()
        let activeLeg = journey.legs.first(where: { leg in
            guard let arrival = parseDate(leg.arrival ?? leg.plannedArrival) else {
                return false
            }
            return arrival > now
        }) ?? journey.legs.last

        let upcomingStop = activeLeg?.stopovers?
            .dropFirst()
            .first(where: { stopover in
                guard let date = parseDate(stopover.arrival ?? stopover.departure) else {
                    return false
                }
                return date > now
            })?.stop?.name

        let nextStop = upcomingStop
            ?? activeLeg?.destination?.name
            ?? destination

        // Die API liefert Verzögerungen in Sekunden. Bei Fußwegen
        // den letzten Abschnitt mit einem Verkehrsmittel verwenden.
        let lastRide = journey.legs.last(where: { $0.walking != true })
        let delay = (lastRide ?? last).arrivalDelay.map {
            Int(($0 / 60).rounded())
        }

        let names = journey.legs.compactMap { leg -> String? in
            if leg.walking == true { return "Fußweg" }
            return leg.line?.name
        }
        let routeSummary = names.joined(separator: " → ")

        return DBConnection(
            line: line,
            nextStop: nextStop,
            origin: origin,
            destination: destination,
            departure: departure,
            arrival: arrival,
            arrivalDelayMinutes: delay,
            routeSummary: routeSummary.isEmpty ? line : routeSummary
        )
    }

    private static func parseDate(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime]
        if let result = parser.date(from: raw) { return result }
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return parser.date(from: raw)
    }
}
