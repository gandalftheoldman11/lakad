import ActivityKit
import SwiftUI
import WidgetKit

@main
struct LakadWidgetBundle: WidgetBundle {
    var body: some Widget {
        LakadLiveActivity()
    }
}

private let cobalt = Color(red: 0.122, green: 0.310, blue: 0.878)   // #1F4FE0
private let mango = Color(red: 1.0, green: 0.714, blue: 0.153)      // #FFB627

/// Moving time: ticks by itself while recording, fixed while paused.
private struct MovingTime: View {
    let state: LakadActivityAttributes.ContentState
    var body: some View {
        if state.paused {
            Text(format(state.movingSeconds))
        } else {
            Text(state.movingSince, style: .timer)
        }
    }
    private func format(_ s: Int) -> String {
        let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec) : String(format: "%d:%02d", m, sec)
    }
}

private struct Stat: View {
    let value: String
    let label: String
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.system(size: 17, weight: .bold, design: .rounded)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.caption2).opacity(0.75).lineLimit(1)
        }
    }
}

private func symbol(_ activity: String) -> String { activity == "Run" ? "figure.run" : "figure.walk" }

struct LockScreenView: View {
    let context: ActivityViewContext<LakadActivityAttributes>
    var body: some View {
        let s = context.state
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: symbol(context.attributes.activity))
                Text(s.paused ? "\(context.attributes.activity) · Paused" : "Lakad · \(context.attributes.activity)")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if context.isStale { Text("Open Lakad").font(.caption.weight(.semibold)).foregroundColor(mango) }
                else { Circle().fill(s.paused ? mango : Color.red).frame(width: 8, height: 8) }
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(s.distance).font(.system(size: 40, weight: .heavy, design: .rounded)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                Text(s.unit).font(.headline).opacity(0.8)
                Spacer(minLength: 8)
                MovingTime(state: s).font(.system(size: 22, weight: .bold, design: .rounded)).monospacedDigit().multilineTextAlignment(.trailing).frame(maxWidth: 110, alignment: .trailing)
            }
            HStack(spacing: 18) {
                Stat(value: s.steps, label: "steps")
                Stat(value: s.pace, label: "avg /\(s.unit)")
                Spacer()
            }
        }
        .padding(16)
        .foregroundColor(.white)
    }
}

struct LakadLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LakadActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(cobalt)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(context.state.distance).font(.system(size: 26, weight: .heavy, design: .rounded)).monospacedDigit()
                        Text(context.state.unit).font(.caption)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    MovingTime(state: context.state).font(.system(size: 20, weight: .bold, design: .rounded)).monospacedDigit().multilineTextAlignment(.trailing).frame(maxWidth: 90, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Label(context.state.steps + " steps", systemImage: symbol(context.attributes.activity))
                        Spacer()
                        Text(context.state.paused ? "Paused" : context.state.pace + " /" + context.state.unit)
                    }
                    .font(.subheadline)
                }
            } compactLeading: {
                Image(systemName: symbol(context.attributes.activity)).foregroundColor(mango)
            } compactTrailing: {
                Text(context.state.distance + " " + context.state.unit).font(.caption.weight(.bold)).monospacedDigit()
            } minimal: {
                Image(systemName: symbol(context.attributes.activity)).foregroundColor(mango)
            }
            .keylineTint(mango)
        }
    }
}
