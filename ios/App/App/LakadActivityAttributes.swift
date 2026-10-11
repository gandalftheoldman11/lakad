import Foundation
#if canImport(ActivityKit)
import ActivityKit

/// What the lock-screen Live Activity shows. Shared by the app (which starts and updates it)
/// and the widget extension (which draws it).
@available(iOS 16.1, *)
public struct LakadActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var distance: String      // "2.34"
        public var unit: String          // "km" or "mi"
        public var steps: String         // "3,120"
        public var pace: String          // "7:45" average per unit, "–" if unknown
        public var paused: Bool
        public var movingSince: Date     // now − moving time: lets the timer tick on its own
        public var movingSeconds: Int    // shown as a fixed time while paused

        public init(distance: String, unit: String, steps: String, pace: String, paused: Bool, movingSince: Date, movingSeconds: Int) {
            self.distance = distance; self.unit = unit; self.steps = steps; self.pace = pace
            self.paused = paused; self.movingSince = movingSince; self.movingSeconds = movingSeconds
        }
    }
    public var activity: String          // "Walk" or "Run"
    public init(activity: String) { self.activity = activity }
}
#endif
