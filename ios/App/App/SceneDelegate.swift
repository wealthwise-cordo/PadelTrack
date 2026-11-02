import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = PadelTrackViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// The app's web view: Capacitor's, plus the iPhone back swipe (swipe in from
// the left edge to go back a page, like Safari). Next.js navigation adds each
// page to the web view's history, so this works on every page — except the
// three main tabs, the app's base layer, where a sideways swipe switches tab
// instead (src/components/shared/TabSwipe.tsx).
class PadelTrackViewController: CAPBridgeViewController {
    private static let tabRoots: Set<String> = ["", "/", "/matches", "/events"]
    private var urlObservation: NSKeyValueObservation?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        urlObservation = webView?.observe(\.url, options: [.initial, .new]) { webView, _ in
            let path = webView.url?.path ?? ""
            webView.allowsBackForwardNavigationGestures = !Self.tabRoots.contains(path)
        }
    }
}
