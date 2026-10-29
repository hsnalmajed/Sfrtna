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
//  - a "no connection" screen that retries by itself;
//  - the opening: the mark, then a plane writing «لكل سفره حكاية»
//    (Android: IntroView.java + TaglineFlightView.java);
//  - the phone's safe area (notch / Dynamic Island, home bar) handed to the
//    page as --safe-area-inset-* — the same CSS variables Android's
//    SystemBars plugin sets, which the app's header and tab bar already use.
// Sign-in is not offered in this first iOS build ("auth" is not in
// `features`), so the account link stays hidden until Sign in with Apple
// is added (App Store rule 4.8).

import SafariServices
import Network
import WebKit
import CoreText

class MainViewController: CAPBridgeViewController {
    private let monitor = NWPathMonitor()
    private var offline: OfflineOverlay?
    private let uiProxy = NewWindowProxy()
    private var intro: IntroOverlay?
    private var loadingWatch: NSKeyValueObservation?
    private var loadsWatch: NSKeyValueObservation?

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
        installSafeArea()
        startIntro()
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async { self?.network(up: path.status == .satisfied) }
        }
        monitor.start(queue: DispatchQueue(label: "sfrtna.net"))
    }

    // MARK: Opening

    /** The ceiling: a slow network never keeps the opening up. */
    private static let maxIntro: TimeInterval = 6

    private func startIntro() {
        // Pinned with constraints: this runs inside loadView, before the
        // view has a size, and an autoresizing child of a 0×0 view stays
        // 0×0 (build 10 never showed the opening for that reason).
        let o = IntroOverlay(frame: UIScreen.main.bounds)
        o.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(o)
        NSLayoutConstraint.activate([
            o.topAnchor.constraint(equalTo: view.topAnchor),
            o.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            o.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            o.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        intro = o
        // The line in the language the visitor last read the site in (the
        // site's sfrtna_lang cookie, see src/components/NavTracker.tsx);
        // before any visit, the phone's own language.
        // The cookie store can be slow to answer on a cold start, so the
        // opening never waits more than a moment for it.
        let phoneEnglish = !(Locale.preferredLanguages.first?.hasPrefix("ar") ?? true)
        var started = false
        let begin: (Bool) -> Void = { english in
            if started { return }
            started = true
            o.start(english: english)
        }
        webView?.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
            let lang = cookies.first { $0.name == "sfrtna_lang" && $0.domain.hasSuffix("sfrtna.com") }?.value
            DispatchQueue.main.async { begin(lang.map { $0 == "en" } ?? phoneEnglish) }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { begin(phoneEnglish) }
        // Leaves once the first page has loaded (and the line has been read).
        loadingWatch = webView?.observe(\.isLoading, options: [.new]) { [weak self] wv, _ in
            // "/" only forwards to /ar or /en: wait for that page, or the
            // forwarding page shows white between the opening and the site.
            let path = wv.url?.path ?? ""
            if !wv.isLoading, path.hasPrefix("/ar") || path.hasPrefix("/en") {
                DispatchQueue.main.async { self?.endIntro() }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + MainViewController.maxIntro) { [weak self] in self?.endIntro() }
    }

    private func endIntro() {
        guard let o = intro else { return }
        intro = nil
        loadingWatch = nil
        o.finish()
    }

    // MARK: Safe area

    /// The notch / Dynamic Island and the home bar, handed to the page as
    /// --safe-area-inset-* (the variables Android's SystemBars plugin sets,
    /// which the app's header and tab bar already use). WebKit gives the
    /// real values through env() once the page's viewport says
    /// viewport-fit=cover, so the script adds that to the page's viewport
    /// tag and maps env() onto the variables. Installed here, before the
    /// first page loads (build 11 measured the window afterwards and sent
    /// numbers — the first page missed them). Kept in a <style> of its own
    /// and put back if React rewrites the head.
    private func installSafeArea() {
        // --safe-area-inset-* = the larger of WebKit's env() and the window's
        // own insets sent from here after each load (window.__sfrNative):
        // build 12 on the simulator showed env() alone still 0.
        let js = """
        (function(){
          var base=':root{--safe-area-inset-top:max(env(safe-area-inset-top,0px),var(--sfr-nt,0px));--safe-area-inset-bottom:max(env(safe-area-inset-bottom,0px),var(--sfr-nb,0px));--safe-area-inset-left:max(env(safe-area-inset-left,0px),var(--sfr-nl,0px));--safe-area-inset-right:max(env(safe-area-inset-right,0px),var(--sfr-nr,0px))}';
          function put(){
            var d=document,s=d.getElementById('sfr-insets'),css=base+(window.__sfrNative||'');
            if(!s){s=d.createElement('style');s.id='sfr-insets';(d.head||d.documentElement).appendChild(s);}
            if(s.textContent!==css)s.textContent=css;
            var m=d.querySelector('meta[name=viewport]');
            if(m&&m.content.indexOf('viewport-fit')===-1)m.content=m.content+', viewport-fit=cover';
          }
          window.__sfrPut=put;
          put();
          new MutationObserver(put).observe(document.documentElement,{childList:true,subtree:true});
          document.addEventListener('DOMContentLoaded',put);
        })();
        """
        webView?.configuration.userContentController.addUserScript(
            WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        loadsWatch = webView?.observe(\.isLoading, options: [.new]) { [weak self] wv, _ in
            if !wv.isLoading { DispatchQueue.main.async { self?.sendInsets() } }
        }
    }

    /// The window's insets as numbers, after every load (and logged, so a
    /// simulator run shows what the page received).
    private func sendInsets() {
        guard let wv = webView else { return }
        let i = view.window?.safeAreaInsets ?? view.safeAreaInsets
        let native = ":root{--sfr-nt:\(Int(i.top))px;--sfr-nb:\(Int(i.bottom))px;--sfr-nl:\(Int(i.left))px;--sfr-nr:\(Int(i.right))px}"
        let js = "window.__sfrNative='\(native)';if(window.__sfrPut)window.__sfrPut();"
            + "getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')+'|'+(!!document.getElementById('sfr-insets'))+'|'+((document.querySelector('meta[name=viewport]')||{}).content)+'|'+location.pathname"
        wv.evaluateJavaScript(js) { result, error in
            NSLog("SFR insets native=%@ page=%@ err=%@", "\(i)", "\(result ?? "nil")", "\(error?.localizedDescription ?? "")")
        }
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

private let sfrNavy = UIColor(red: 0x0B / 255, green: 0x2D / 255, blue: 0x5B / 255, alpha: 1)
private let sfrSun = UIColor(red: 0xFF / 255, green: 0xA6 / 255, blue: 0x30 / 255, alpha: 1)

/// The opening (Android: IntroView.java). The Sfrtna mark arrives with a
/// small overshoot, then a plane writes the tagline. Stays at least
/// `minShow` so the line can be read; leaves when the first page has loaded.
/// With Reduce Motion on, everything simply appears.
final class IntroOverlay: UIView {
    static let minShow: TimeInterval = 1.3
    private let shownAt = Date()
    private let mark = UIImageView(image: UIImage(named: "IntroMark"))
    private let tagline = TaglineFlightView()
    private var link: CADisplayLink?
    private var writeStart: CFTimeInterval = 0
    private var leaving = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .white
        isUserInteractionEnabled = true // Taps stay off the page while it loads.
        mark.contentMode = .scaleAspectFit
        mark.translatesAutoresizingMaskIntoConstraints = false
        tagline.translatesAutoresizingMaskIntoConstraints = false
        tagline.backgroundColor = .clear
        addSubview(mark)
        addSubview(tagline)
        NSLayoutConstraint.activate([
            mark.widthAnchor.constraint(equalToConstant: 212),
            mark.heightAnchor.constraint(equalToConstant: 170),
            mark.centerXAnchor.constraint(equalTo: centerXAnchor),
            // A little above centre, where the eye rests.
            mark.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -90),
            tagline.topAnchor.constraint(equalTo: mark.bottomAnchor, constant: 4),
            tagline.leadingAnchor.constraint(equalTo: leadingAnchor),
            tagline.trailingAnchor.constraint(equalTo: trailingAnchor),
            tagline.heightAnchor.constraint(equalToConstant: 34 * 2.6),
        ])
        mark.alpha = 0
        mark.transform = CGAffineTransform(scaleX: 0.7, y: 0.7)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    func start(english: Bool) {
        tagline.set(text: english ? "Every trip has a story" : "لكل سفره حكاية", rtl: !english)
        if UIAccessibility.isReduceMotionEnabled {
            mark.alpha = 1
            mark.transform = .identity
            tagline.progress = 1
            return
        }
        UIView.animate(withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.6, initialSpringVelocity: 0.5) {
            self.mark.alpha = 1
            self.mark.transform = .identity
        }
        writeStart = CACurrentMediaTime() + 0.22
        let l = CADisplayLink(target: self, selector: #selector(tick))
        l.add(to: .main, forMode: .common)
        link = l
    }

    @objc private func tick() {
        let t = (CACurrentMediaTime() - writeStart) / 0.9
        if t < 0 { return }
        // Ease in and out, as Android's AccelerateDecelerateInterpolator.
        let c = min(1, t)
        tagline.progress = CGFloat((1 - cos(Double.pi * c)) / 2)
        if c >= 1 { link?.invalidate(); link = nil }
    }

    func finish() {
        if leaving { return }
        leaving = true
        let wait = max(0, IntroOverlay.minShow - Date().timeIntervalSince(shownAt))
        DispatchQueue.main.asyncAfter(deadline: .now() + wait) {
            self.link?.invalidate()
            self.tagline.progress = 1
            if UIAccessibility.isReduceMotionEnabled { self.removeFromSuperview(); return }
            UIView.animate(withDuration: 0.24, animations: {
                self.alpha = 0
                self.mark.transform = CGAffineTransform(translationX: 0, y: -12)
            }, completion: { _ in self.removeFromSuperview() })
        }
    }
}

/// The tagline, written by a plane on a shallow arc, a dashed gold trail
/// behind it (Android: TaglineFlightView.java). Set in Tajawal ExtraBold,
/// the site's display face (bundled as data assets, SIL OFL —
/// mobile/licenses).
final class TaglineFlightView: UIView {
    var progress: CGFloat = 0 { didSet { setNeedsDisplay() } }
    private var text = ""
    private var rtl = true
    private var font = UIFont.systemFont(ofSize: 34, weight: .heavy)
    private let plane = UIImage(systemName: "airplane")?.withTintColor(sfrNavy, renderingMode: .alwaysOriginal)

    func set(text: String, rtl: Bool) {
        self.text = text
        self.rtl = rtl
        font = TaglineFlightView.tajawal(arabic: rtl, size: 34)
        setNeedsDisplay()
    }

    static func tajawal(arabic: Bool, size: CGFloat) -> UIFont {
        let asset = arabic ? "TajawalArabic800" : "TajawalLatin800"
        if let data = NSDataAsset(name: asset)?.data,
           let provider = CGDataProvider(data: data as CFData),
           let cg = CGFont(provider) {
            CTFontManagerRegisterGraphicsFont(cg, nil) // Already registered: harmless.
            if let name = cg.postScriptName as String?, let f = UIFont(name: name, size: size) { return f }
        }
        return .systemFont(ofSize: size, weight: .heavy)
    }

    override func draw(_ rect: CGRect) {
        guard !text.isEmpty, let ctx = UIGraphicsGetCurrentContext() else { return }
        let w = bounds.width
        let para = NSMutableParagraphStyle()
        para.baseWritingDirection = rtl ? .rightToLeft : .leftToRight
        let line = NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: sfrNavy, .paragraphStyle: para])
        let size = line.size()
        let pad: CGFloat = 18
        let start = rtl ? (w + size.width) / 2 + pad : (w - size.width) / 2 - pad
        let end = rtl ? (w - size.width) / 2 - pad : (w + size.width) / 2 + pad
        let baseline = bounds.height * 0.78
        let flyY = baseline - font.pointSize * 1.25
        let lift: CGFloat = 14
        let t = progress
        let x = start + (end - start) * t
        let y = flyY - CGFloat(sin(Double.pi * Double(t))) * lift

        // The words, uncovered up to the plane.
        ctx.saveGState()
        ctx.clip(to: rtl ? CGRect(x: min(x, w), y: 0, width: w, height: bounds.height)
                          : CGRect(x: 0, y: 0, width: max(x, 0), height: bounds.height))
        line.draw(at: CGPoint(x: (w - size.width) / 2, y: baseline - font.ascender))
        ctx.restoreGState()

        // The trail behind it, fading out once the plane has gone.
        if t > 0 {
            let trail = UIBezierPath()
            for i in 0...40 {
                let ti = t * CGFloat(i) / 40
                let p = CGPoint(x: start + (end - start) * ti, y: flyY - CGFloat(sin(Double.pi * Double(ti))) * lift)
                if i == 0 { trail.move(to: p) } else { trail.addLine(to: p) }
            }
            trail.lineWidth = 2.5
            trail.lineCapStyle = .round
            trail.setLineDash([7, 6], count: 2, phase: 0)
            sfrSun.withAlphaComponent(t < 0.85 ? 1 : (1 - t) / 0.15).setStroke()
            trail.stroke()
        }

        // The plane, nose along its path; it fades as it leaves.
        if let plane = plane, t < 1 {
            let s: CGFloat = 26
            let dx = end - start
            let dy = -lift * CGFloat.pi * CGFloat(cos(Double.pi * Double(t)))
            ctx.saveGState()
            ctx.translateBy(x: x, y: y)
            ctx.rotate(by: atan2(dy, dx)) // The symbol points right.
            plane.draw(in: CGRect(x: -s / 2, y: -s / 2, width: s, height: s), blendMode: .normal, alpha: t < 0.9 ? 1 : (1 - t) / 0.1)
            ctx.restoreGState()
        }
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
