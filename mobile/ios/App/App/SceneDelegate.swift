import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // Our shell (AppDelegate.swift), not the bare Capacitor controller — with
        // the bare one none of the app's own code ran (builds 9–11).
        // The app's own tabs, opening on «اليوم»; the website is one tab
        // (App Review 4.3 / 4.2.6, 16 Nov 2026).
        window?.rootViewController = RootTabController(web: MainViewController())
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        // Opened from the home-screen shortcut «وضع الرحلة» (Info.plist).
        if connectionOptions.shortcutItem?.type == TripMode.shortcutType { TripMode.open("") }
    }

    /// The phone keeps at most 64 waiting alerts: trip mode schedules the
    /// next 60 of all kept plans, so each visit moves the window forward.
    func sceneDidBecomeActive(_ scene: UIScene) {
        TripAlerts.rescheduleAll()
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        let ours = shortcutItem.type == TripMode.shortcutType
        if ours { TripMode.open("") }
        completionHandler(ours)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
