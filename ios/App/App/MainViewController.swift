import UIKit
import Capacitor

/// Registers Lakad's own native plugins (Capacitor finds npm plugins automatically).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }
}
