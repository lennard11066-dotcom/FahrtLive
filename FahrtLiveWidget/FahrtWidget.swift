import SwiftUI
import WidgetKit
import ActivityKit

struct FahrtWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FahrtAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(context.state.line)
                        .font(.headline)
                    Spacer()
                    if context.state.hasRealtimeData {
                        Text(
                            context.state.delayMinutes > 0
                                ? "+\(context.state.delayMinutes) Min."
                                : (context.state.delayMinutes < 0
                                    ? "\(abs(context.state.delayMinutes)) Min. früher"
                                    : "Pünktlich")
                        )
                        .foregroundStyle(
                            context.state.delayMinutes > 0 ? .orange : .green
                        )
                    } else {
                        Text("Keine Echtzeit")
                            .font(.caption)
                            .foregroundStyle(.gray)
                    }
                }

                Text(context.state.nextStop)
                    .font(.subheadline)
                    .lineLimit(1)

                ProgressView(value: context.state.progress)

                HStack {
                    Text("Ziel: \(context.state.destination)")
                    Spacer()
                    Text("\(context.state.remainingMinutes) Min.")
                }
                .font(.caption)
            }
            .foregroundStyle(.white)
            .padding()
            .activityBackgroundTint(.black)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.line)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.remainingMinutes) Min.")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.destination)
                }
            } compactLeading: {
                Text(context.state.line)
            } compactTrailing: {
                Text("\(context.state.remainingMinutes)m")
            } minimal: {
                Text(context.state.line)
            }
        }
    }
}

@main
struct FahrtWidgetBundle: WidgetBundle {
    var body: some Widget {
        FahrtWidget()
    }
}
