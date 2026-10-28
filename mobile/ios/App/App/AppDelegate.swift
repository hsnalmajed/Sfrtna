import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - Sfrtna shell
//
// Kept in this file so the Xcode project needs no new file entries (the
// project is generated on Linux and built on GitHub's macOS machines).
// The same jobs as the Android shell (mobile/android/.../SfrtnaAppPlugin.java,
// AppWebViewClient.java, OfflineView.java):
//  - our pages stay in the app; another site opens in an in-app Safari sheet;
//  - tel:/mailto:/whatsapp: go to their apps;
//  - shareFile (KML/GPX → share sheet) and print (save as PDF);
//  - a "no connection" screen that retries by itself.
// Sign-in is not offered in this first iOS build ("auth" is not in
// `features`), so the account link stays hidden until Sign in with Apple
// is added (App Store rule 4.8).

import SafariServices
import Network
import WebKit

class MainViewController: CAPBridgeViewController {
    private let monitor = NWPathMonitor()
    private var offline: OfflineOverlay?
    private let uiProxy = NewWindowProxy()

    func openOutside(_ url: URL) {
        let safari = SFSafariViewController(url: url)
        safari.preferredControlTintColor = UIColor(red: 0x0B / 255, green: 0x2D / 255, blue: 0x5B / 255, alpha: 1)
        present(safari, animated: true)
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SfrtnaAppPlugin())
        view.backgroundColor = UIColor(red: 0x0B / 255, green: 0x2D / 255, blue: 0x5B / 255, alpha: 1)
        webView?.isOpaque = false
        webView?.backgroundColor = view.backgroundColor
        webView?.allowsBackForwardNavigationGestures = true
        // target="_blank" / window.open(): our pages in the app, other sites
        // in the in-app Safari sheet (Capacitor alone sends them to Safari).
        if let wv = webView {
            uiProxy.original = wv.uiDelegate
            uiProxy.host = self
            wv.uiDelegate = uiProxy
        }
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async { self?.network(up: path.status == .satisfied) }
        }
        monitor.start(queue: DispatchQueue(label: "sfrtna.net"))
    }

    private func network(up: Bool) {
        if up {
            guard let o = offline else { return }
            o.removeFromSuperview()
            offline = nil
            if let url = URL(string: "https://sfrtna.com") {
                let current = webView?.url
                if current == nil || current?.host != "sfrtna.com" { webView?.load(URLRequest(url: url)) } else { webView?.reload() }
            }
        } else if offline == nil {
            let o = OfflineOverlay(frame: view.bounds)
            o.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            o.onRetry = { [weak self] in self?.webView?.reload() }
            view.addSubview(o)
            offline = o
        }
    }
}

/// Wraps Capacitor's WKUIDelegate: only new windows are handled here, every
/// other call (alerts, file pickers, permissions) goes to Capacitor.
final class NewWindowProxy: NSObject, WKUIDelegate {
    weak var original: WKUIDelegate?
    weak var host: MainViewController?

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        let scheme = url.scheme?.lowercased() ?? ""
        if let h = url.host?.lowercased(), h == "sfrtna.com" || h == "www.sfrtna.com" {
            webView.load(URLRequest(url: url))
        } else if scheme == "https" || scheme == "http" {
            host?.openOutside(url)
        } else {
            UIApplication.shared.open(url)
        }
        return nil
    }

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || (original?.responds(to: aSelector) ?? false)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let o = original, o.responds(to: aSelector) { return o }
        return super.forwardingTarget(for: aSelector)
    }
}

final class OfflineOverlay: UIView {
    var onRetry: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor(red: 0x0B / 255, green: 0x2D / 255, blue: 0x5B / 255, alpha: 1)
        let arabic = Locale.preferredLanguages.first?.hasPrefix("ar") ?? true
        let title = UILabel()
        title.text = arabic ? "لا يوجد اتصال بالإنترنت" : "No internet connection"
        title.font = .boldSystemFont(ofSize: 22)
        title.textColor = .white
        let body = UILabel()
        body.text = arabic ? "سنعيد المحاولة تلقائياً عند عودة الاتصال." : "We will try again as soon as you are back online."
        body.textColor = UIColor.white.withAlphaComponent(0.8)
        body.numberOfLines = 0
        body.textAlignment = .center
        let button = UIButton(type: .system)
        button.setTitle(arabic ? "أعد المحاولة" : "Try again", for: .normal)
        button.titleLabel?.font = .boldSystemFont(ofSize: 17)
        button.backgroundColor = UIColor(red: 1, green: 0.65, blue: 0.19, alpha: 1)
        button.setTitleColor(UIColor(red: 0.04, green: 0.12, blue: 0.24, alpha: 1), for: .normal)
        button.layer.cornerRadius = 14
        button.contentEdgeInsets = UIEdgeInsets(top: 12, left: 28, bottom: 12, right: 28)
        button.addTarget(self, action: #selector(retry), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [title, body, button])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -24),
        ])
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    @objc private func retry() { onRetry?() }
}

@objc(SfrtnaAppPlugin)
public class SfrtnaAppPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SfrtnaAppPlugin"
    public let jsName = "SfrtnaApp"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise),
    ]

    private static let ourHosts: Set<String> = ["sfrtna.com", "www.sfrtna.com"]
    private static let appSchemes: Set<String> = ["tel", "mailto", "sms", "whatsapp", "maps", "comgooglemaps", "itms-apps"]

    /// Our pages stay in the app; a link to another site (partner, visa
    /// office) opens in an in-app Safari sheet over the app. Embedded
    /// widgets (iframes) navigate inside themselves, untouched.
    override public func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else { return nil }
        if SfrtnaAppPlugin.appSchemes.contains(scheme) {
            DispatchQueue.main.async { UIApplication.shared.open(url) }
            return NSNumber(value: true)
        }
        guard scheme == "https" || scheme == "http" else { return nil }
        let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        if !mainFrame { return nil }
        if let host = url.host?.lowercased(), SfrtnaAppPlugin.ourHosts.contains(host) { return NSNumber(value: false) }
        DispatchQueue.main.async { [weak self] in
            (self?.bridge?.viewController as? MainViewController)?.openOutside(url)
        }
        return NSNumber(value: true)
    }

    @objc func info(_ call: CAPPluginCall) {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        call.resolve(["platform": "ios", "version": version, "features": ["share", "print"]])
    }

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let content = call.getString("content"), content.count <= 5_000_000 else {
            call.reject("bad_content")
            return
        }
        var safe = (call.getString("name") ?? "").replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "_", options: .regularExpression)
        if safe.isEmpty || safe.hasPrefix(".") { safe = "sfrtna" + safe }
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
        do {
            try content.write(to: file, atomically: true, encoding: .utf8)
        } catch {
            call.reject("write_failed")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let vc = self?.bridge?.viewController else { call.reject("no_view"); return }
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = vc.view
            vc.present(sheet, animated: true)
            call.resolve()
        }
    }

    @objc func print(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "Sfrtna"
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.bridge?.webView else { call.reject("no_view"); return }
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = title
            let controller = UIPrintInteractionController.shared
            controller.printInfo = info
            controller.printFormatter = webView.viewPrintFormatter()
            controller.present(animated: true)
            call.resolve()
        }
    }
}
