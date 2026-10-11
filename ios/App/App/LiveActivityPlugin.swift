import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Starts, updates and ends Lakad's lock-screen Live Activity (iOS 16.2+).
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LakadLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
            return
        }
        #endif
        call.resolve(["available": false])
    }

    @objc func start(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(["started": false]); return }
            let state = makeState(call)
            let attributes = LakadActivityAttributes(activity: call.getString("activity") ?? "Walk")
            Task {
                // Only one recording at a time: close anything left over (e.g. after the app was closed)
                for old in Activity<LakadActivityAttributes>.activities {
                    await old.end(nil, dismissalPolicy: .immediate)
                }
                do {
                    _ = try Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil), pushType: nil)
                    call.resolve(["started": true])
                } catch {
                    call.resolve(["started": false, "error": error.localizedDescription])
                }
            }
            return
        }
        #endif
        call.resolve(["started": false])
    }

    @objc func update(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            let state = makeState(call)
            // If the app stops updating (closed by iOS), the card is marked stale after 10 minutes
            let stale: Date? = state.paused ? nil : Date().addingTimeInterval(600)
            Task {
                for activity in Activity<LakadActivityAttributes>.activities {
                    await activity.update(ActivityContent(state: state, staleDate: stale))
                }
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }

    @objc func end(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            let immediate = call.getBool("immediate") ?? true
            let state = makeState(call)
            Task {
                for activity in Activity<LakadActivityAttributes>.activities {
                    // After finishing, leave the final result on the lock screen for 5 minutes
                    await activity.end(ActivityContent(state: state, staleDate: nil),
                                       dismissalPolicy: immediate ? .immediate : .after(Date().addingTimeInterval(300)))
                }
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }

    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private func makeState(_ call: CAPPluginCall) -> LakadActivityAttributes.ContentState {
        let moving = max(0, call.getInt("movingSeconds") ?? 0)
        return LakadActivityAttributes.ContentState(
            distance: call.getString("distance") ?? "0.00",
            unit: call.getString("unit") ?? "km",
            steps: call.getString("steps") ?? "0",
            pace: call.getString("pace") ?? "–",
            paused: call.getBool("paused") ?? false,
            movingSince: Date().addingTimeInterval(-Double(moving)),
            movingSeconds: moving
        )
    }
    #endif
}
