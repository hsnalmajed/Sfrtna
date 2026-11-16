import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Trip mode's reminders (TripAlerts): shown even while the app is open,
        // and a tap opens the plan they belong to.
        UNUserNotificationCenter.current().delegate = self
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
        // (Scenes are on: SceneDelegate.sceneDidBecomeActive does the work.)
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

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let plan = response.notification.request.content.userInfo["plan"] as? String
        DispatchQueue.main.async { TripMode.open(plan ?? "") }
        completionHandler()
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
        // Only for the simulator check in CI (ios.yml launches with this
        // argument): the welcome cards are marked seen, so the home page
        // and its top bar can be photographed. Users never pass arguments.
        if ProcessInfo.processInfo.arguments.contains("-sfrSkipWelcome") {
            webView?.configuration.userContentController.addUserScript(WKUserScript(
                source: "try{localStorage.setItem('sfr-welcome-v1','1');localStorage.setItem('sfrtna-consent-v1','denied');document.cookie='sfrtna_origin=RUH; path=/; max-age=86400';localStorage.setItem('sfr-tips-v1','[\"home\",\"results\",\"hotels\",\"city\",\"discover\",\"trip\"]');}catch(e){}",
                injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        // Also CI only: -sfrPath opens one of our pages, -sfrDo then runs one
        // native action there (partner sheet, print, share) so the simulator
        // can photograph it. Users never pass arguments.
        let args = ProcessInfo.processInfo.arguments
        func arg(_ key: String) -> String? {
            guard let i = args.firstIndex(of: key), i + 1 < args.count else { return nil }
            return args[i + 1]
        }
        if let path = arg("-sfrPath"), path.hasPrefix("/"),
           let data = try? JSONSerialization.data(withJSONObject: [path, arg("-sfrDo") ?? ""]),
           let json = String(data: data, encoding: .utf8) {
            webView?.configuration.userContentController.addUserScript(WKUserScript(
                source: "window.__sfrCheck=\(json);" + MainViewController.checkScript,
                injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        // CI only: -sfrTrip opens trip mode ("" list, qibla, mosques, halal)
        // once the opening ends, so the simulator can photograph it.
        if let trip = arg("-sfrTrip") { TripMode.pending = trip == "list" ? "" : trip }
        startIntro()
        NotificationCenter.default.addObserver(self, selector: #selector(openTripModeRequest), name: TripMode.openRequest, object: nil)
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async { self?.network(up: path.status == .satisfied) }
        }
        monitor.start(queue: DispatchQueue(label: "sfrtna.net"))
    }

    /** The CI check (see -sfrPath): go to the page once, then do the action once. */
    private static let checkScript = #"""
    (function () {
      var c = window.__sfrCheck, path = c[0], todo = c[1], s = window.sessionStorage;
      try {
        if (!s.getItem("sfrCheckNav")) { s.setItem("sfrCheckNav", "1"); location.replace(path); return; }
        if (!todo || s.getItem("sfrCheckDone")) return;
      } catch (e) { return; }
      var n = 0, timer = setInterval(function () {
        n++;
        var app = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SfrtnaApp;
        if (todo === "partner") {
          // Prefer a link through our /api/go/ redirect (the harder case).
          var all = Array.prototype.filter.call(document.querySelectorAll('a[data-partner]:not([data-partner^="app"])'),
            function (x) { return x.offsetParent !== null && /^https?:/.test(x.href); });
          var a = all.filter(function (x) { return x.href.indexOf("/api/go/") > 0; })[0] || all[0];
          // None on screen after 15 s: the same kind of link the site builds.
          if (!a && n >= 15) {
            a = document.createElement("a");
            a.href = "/api/go/expedia?landing=" + encodeURIComponent("https://www.expedia.com/Hotel-Search?destination=Istanbul");
          }
          var tag = document.getElementById("sfr-check") || document.body.appendChild(document.createElement("div"));
          tag.id = "sfr-check";
          tag.style.cssText = "position:fixed;left:8px;right:8px;bottom:140px;z-index:2147483647;background:#c00;color:#fff;font:14px/1.4 monospace;padding:6px;direction:ltr";
          tag.textContent = a ? "CHECK partner -> " + a.hostname + a.pathname.slice(0, 20) : "CHECK no partner link yet (" + n + "s)";
          // A script cannot open a new window without a tap, so the link is
          // followed in the page itself: the same in-app Safari sheet opens.
          if (a) { clearInterval(timer); s.setItem("sfrCheckDone", "1"); location.href = a.href; }
        } else if (app && n >= 4) {
          clearInterval(timer); s.setItem("sfrCheckDone", "1");
          if (todo === "print") app.print({ title: "Sfrtna" });
          if (todo === "share") app.shareFile({ name: "sfrtna-plan.gpx", mimeType: "application/gpx+xml",
            content: '<?xml version="1.0"?><gpx version="1.1" creator="Sfrtna"></gpx>' });
        }
        if (n > 60) clearInterval(timer);
      }, 1000);
    })();
    """#

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
            DispatchQueue.main.async {
                let english = lang.map { $0 == "en" } ?? phoneEnglish
                // The app's own screens follow the site: Arabic unless it was read in English.
                let native = lang.map { $0 == "en" } ?? false
                if TripMode.english != native {
                    TripMode.english = native
                    (self.tabBarController as? RootTabController)?.relabel()
                }
                begin(english)
            }
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
        // A reminder tapped or the home-screen shortcut used while the app was closed.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in self?.openTripModeRequest() }
    }

    // MARK: Trip mode

    /// TripMode.open(…) from a reminder, the home-screen shortcut, the
    /// offline screen or the site. Waits for the opening to finish.
    @objc func openTripModeRequest() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in self?.openTripModeRequest() }
            return
        }
        // Inside the tabs (RootTabController) the tabs open trip mode.
        guard tabBarController == nil else { return }
        guard intro == nil, view.window != nil, let target = TripMode.pending else { return }
        TripMode.pending = nil
        if let nav = presentedViewController as? TripNavController {
            nav.go(target)
            return
        }
        let openNav = { [weak self] in
            guard let self = self else { return }
            let nav = TripNavController(target: target)
            self.present(nav, animated: true)
        }
        if presentedViewController != nil { dismiss(animated: false, completion: openNav) } else { openNav() }
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
        // The sheet is adopted by the document (document.adoptedStyleSheets),
        // not a <style> in <head>: React rewrites the head when it renders
        // and dropped the element (seen 29 Oct, build 13). A <style> kept
        // alive by an observer is the fallback for iOS before 16.4.
        let js = """
        (function(){
          var base=':root{--safe-area-inset-top:max(env(safe-area-inset-top,0px),var(--sfr-nt,0px));--safe-area-inset-bottom:max(env(safe-area-inset-bottom,0px),var(--sfr-nb,0px));--safe-area-inset-left:max(env(safe-area-inset-left,0px),var(--sfr-nl,0px));--safe-area-inset-right:max(env(safe-area-inset-right,0px),var(--sfr-nr,0px))}';
          var sheet=null;
          try{sheet=new CSSStyleSheet();document.adoptedStyleSheets=document.adoptedStyleSheets.concat([sheet]);}catch(e){sheet=null;}
          function put(){
            var d=document,css=base+(window.__sfrNative||'');
            if(sheet){
              if(sheet.__css!==css){sheet.replaceSync(css);sheet.__css=css;}
              if(d.adoptedStyleSheets.indexOf(sheet)===-1)d.adoptedStyleSheets=d.adoptedStyleSheets.concat([sheet]);
            }else{
              var s=d.getElementById('sfr-insets');
              if(!s){s=d.createElement('style');s.id='sfr-insets';(d.head||d.documentElement).appendChild(s);}
              if(s.textContent!==css)s.textContent=css;
            }
            var m=d.querySelector('meta[name=viewport]');
            if(m&&m.content.indexOf('viewport-fit')===-1)m.content=m.content+', viewport-fit=cover';
          }
          window.__sfrPut=put;
          put();
          new MutationObserver(put).observe(document,{childList:true,subtree:true});
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
            + "getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')+'|'+(document.adoptedStyleSheets.length)+'|'+((document.querySelector('meta[name=viewport]')||{}).content)+'|'+location.pathname"
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
            o.onTripMode = { TripMode.open("") }
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
        if let h = url.host?.lowercased(), h == "sfrtna.com" || h == "www.sfrtna.com", !SfrtnaAppPlugin.isOutLink(url) {
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
    var onTripMode: (() -> Void)?

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
        // Kept plans, qibla: they work without the internet (trip mode).
        let trip = UIButton(type: .system)
        let kept = TripStore.count()
        trip.setTitle(arabic
            ? (kept > 0 ? "🧭 وضع الرحلة · خططك المحفوظة (\(kept))" : "🧭 وضع الرحلة · القبلة")
            : (kept > 0 ? "🧭 Trip mode · your saved plans (\(kept))" : "🧭 Trip mode · qibla"), for: .normal)
        trip.titleLabel?.font = .boldSystemFont(ofSize: 16)
        trip.setTitleColor(.white, for: .normal)
        trip.layer.cornerRadius = 14
        trip.layer.borderWidth = 1
        trip.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        trip.contentEdgeInsets = UIEdgeInsets(top: 12, left: 22, bottom: 12, right: 22)
        trip.addTarget(self, action: #selector(tripMode), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [title, body, button, trip])
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
    @objc private func tripMode() { onTripMode?() }
}

@objc(SfrtnaAppPlugin)
public class SfrtnaAppPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SfrtnaAppPlugin"
    public let jsName = "SfrtnaApp"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise),
        // «وضع الرحلة» (16 Nov 2026), see TripMode below.
        CAPPluginMethod(name: "keepPlan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forgetPlan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "planState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAlerts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openTripMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnPromise),
    ]

    static let ourHosts: Set<String> = ["sfrtna.com", "www.sfrtna.com"]

    /// Our /api/go/… links only redirect to a partner site: they open in the
    /// in-app Safari sheet like any partner link, never inside the app.
    static func isOutLink(_ url: URL) -> Bool {
        url.path.hasPrefix("/api/go/")
    }
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
        // ?sfr_out=1: one of our booking pages, which open in a Safari sheet
        // from the app (IosTabsGuard on the site), never inside it.
        let outside = url.query?.contains("sfr_out=1") ?? false
        if let host = url.host?.lowercased(), SfrtnaAppPlugin.ourHosts.contains(host), !SfrtnaAppPlugin.isOutLink(url), !outside {
            return NSNumber(value: false)
        }
        DispatchQueue.main.async { [weak self] in
            (self?.bridge?.viewController as? MainViewController)?.openOutside(url)
        }
        return NSNumber(value: true)
    }

    @objc func info(_ call: CAPPluginCall) {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        call.resolve(["platform": "ios", "version": version, "features": ["share", "share-binary", "print", "trip-mode", "haptics"]])
    }

    // MARK: Trip mode calls from the site (src/lib/nativeApp.ts)

    /// A plan kept on the phone: the page the site drew for it (offline,
    /// self-contained) and its reminders. The alert switches survive updates.
    @objc func keepPlan(_ call: CAPPluginCall) {
        guard let id = TripStore.cleanId(call.getString("id")),
              let html = call.getString("html"), !html.isEmpty, html.utf8.count <= 3_000_000 else {
            call.reject("bad_plan")
            return
        }
        let old = TripStore.load(id)
        if old == nil && TripStore.count() >= TripStore.maxPlans {
            call.reject("full")
            return
        }
        let notices: [[String: String]] = (call.getArray("notices") ?? []).prefix(400).compactMap { value in
            guard let o = value as? JSObject else { return nil }
            var out: [String: String] = [:]
            for key in ["kind", "date", "time", "tz", "title", "body"] {
                if let s = o[key] as? String { out[key] = String(s.prefix(300)) }
            }
            return out
        }
        func text(_ key: String) -> String { String((call.getString(key) ?? "").prefix(200)) }
        // The days in short (date, city, first stops) for «اليوم».
        let days: [[String: Any]] = (call.getArray("days") ?? []).prefix(60).compactMap { value in
            guard let o = value as? JSObject, let date = o["date"] as? String else { return nil }
            let stops: [[String: String]] = ((o["stops"] as? JSArray) ?? []).prefix(12).compactMap { v in
                guard let st = v as? JSObject else { return nil }
                return ["time": String((st["time"] as? String ?? "").prefix(8)), "name": String((st["name"] as? String ?? "").prefix(120))]
            }
            return ["date": String(date.prefix(10)), "city": String((o["city"] as? String ?? "").prefix(80)), "stops": stops]
        }
        var plan: [String: Any] = [
            "id": id, "title": text("title"), "subtitle": text("subtitle"),
            "from": text("from"), "to": text("to"), "lang": text("lang"),
            "html": html, "notices": notices, "days": days,
            "savedAt": ISO8601DateFormatter().string(from: Date()),
        ]
        plan["remind"] = old?["remind"] as? Bool ?? false
        plan["prayers"] = old?["prayers"] as? Bool ?? false
        guard TripStore.save(plan) else {
            call.reject("write_failed")
            return
        }
        TripAlerts.rescheduleAll()
        call.resolve(TripStore.state(plan))
    }

    @objc func forgetPlan(_ call: CAPPluginCall) {
        guard let id = TripStore.cleanId(call.getString("id")) else { call.reject("bad_id"); return }
        TripStore.remove(id)
        TripAlerts.rescheduleAll()
        call.resolve(TripStore.state(nil))
    }

    @objc func planState(_ call: CAPPluginCall) {
        guard let id = TripStore.cleanId(call.getString("id")) else { call.reject("bad_id"); return }
        call.resolve(TripStore.state(TripStore.load(id)))
    }

    /// Turning a switch on asks for the phone's permission (only then).
    @objc func setAlerts(_ call: CAPPluginCall) {
        guard let id = TripStore.cleanId(call.getString("id")) else { call.reject("bad_id"); return }
        TripAlerts.set(id: id, remind: call.getBool("remind") ?? false, prayers: call.getBool("prayers") ?? false) { state, granted in
            var out = state
            out["granted"] = granted
            call.resolve(out)
        }
    }

    /// target: "qibla", "mosques", "halal", a kept plan's id, or nothing (the list).
    @objc func openTripMode(_ call: CAPPluginCall) {
        let target = call.getString("target") ?? ""
        DispatchQueue.main.async {
            TripMode.open(target)
            call.resolve()
        }
    }

    @objc func haptic(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? "light"
        DispatchQueue.main.async {
            if kind == "success" {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } else {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
            call.resolve()
        }
    }

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let content = call.getString("content"), content.count <= 12_000_000 else {
            call.reject("bad_content")
            return
        }
        var safe = (call.getString("name") ?? "").replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "_", options: .regularExpression)
        if safe.isEmpty || safe.hasPrefix(".") { safe = "sfrtna" + safe }
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
        do {
            // «base64»: a picture (the plan's route image); otherwise text (KML/GPX).
            if call.getString("encoding") == "base64" {
                guard let data = Data(base64Encoded: content, options: .ignoreUnknownCharacters) else { call.reject("bad_content"); return }
                try data.write(to: file, options: .atomic)
            } else {
                try content.write(to: file, atomically: true, encoding: .utf8)
            }
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

// MARK: - Trip mode («وضع الرحلة», 16 Nov 2026)
//
// What the phone app adds to the site (App Review 4.3 / 4.2.6, owner's
// decision 15 Nov): a plan kept ON the phone that opens with no internet,
// reminders before and during the trip and prayer alerts in the city's own
// time (local notifications, permission asked only when switched on), the
// qibla compass, and the nearest mosques / halal restaurants. The site draws
// the plan's offline page and its reminder list (src/lib/tripMode.ts) and
// hands them over through the plugin above; everything here works offline
// except the nearby search.

import CoreLocation
import MapKit

enum TripMode {
    /// The language the visitor last used on the site (set from the
    /// sfrtna_lang cookie at launch), else the phone's.
    /// (Arabic until the cookie says English: the site's own default.)
    static var english = false
    static func t(_ ar: String, _ en: String) -> String { english ? en : ar }
    static let navy = UIColor(red: 0x0B / 255, green: 0x2D / 255, blue: 0x5B / 255, alpha: 1)
    static let gold = UIColor(red: 0xF8 / 255, green: 0xB8 / 255, blue: 0x40 / 255, alpha: 1)
    static let openRequest = Notification.Name("SfrtnaOpenTripMode")
    /// Waiting to be shown ("" = the trip mode list) until the main screen is ready.
    static var pending: String?
    static let shortcutType = "com.sfrtna.app.tripmode"

    static func open(_ target: String) {
        pending = target
        NotificationCenter.default.post(name: openRequest, object: nil)
    }

    static func km(_ meters: CLLocationDistance) -> String {
        if meters < 1000 { return english ? "\(Int(meters.rounded())) m" : "\(Int(meters.rounded())) م" }
        let f = NumberFormatter()
        f.locale = Locale(identifier: "en")
        f.maximumFractionDigits = meters < 10_000 ? 1 : 0
        let n = f.string(from: NSNumber(value: meters / 1000)) ?? "\(Int(meters / 1000))"
        return english ? "\(n) km" : "\(n) كم"
    }
}

/// Kept plans: one JSON file each in Application Support/plans (backed up
/// with the phone, never sent anywhere).
enum TripStore {
    static let maxPlans = 30

    static var dir: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("plans", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }

    static func cleanId(_ s: String?) -> String? {
        guard let s = s, !s.isEmpty, s.count <= 100,
              s.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else { return nil }
        return s
    }

    private static func file(_ id: String) -> URL { dir.appendingPathComponent(id + ".json") }

    private static func read(_ url: URL) -> [String: Any]? {
        guard let data = try? Data(contentsOf: url),
              let obj = try? JSONSerialization.jsonObject(with: data) else { return nil }
        return obj as? [String: Any]
    }

    static func load(_ id: String) -> [String: Any]? { read(file(id)) }

    static func save(_ plan: [String: Any]) -> Bool {
        guard let id = cleanId(plan["id"] as? String), JSONSerialization.isValidJSONObject(plan),
              let data = try? JSONSerialization.data(withJSONObject: plan) else { return false }
        do {
            try data.write(to: file(id), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            return true
        } catch {
            return false
        }
    }

    static func remove(_ id: String) { try? FileManager.default.removeItem(at: file(id)) }

    private static func files() -> [URL] {
        ((try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? [])
            .filter { $0.pathExtension == "json" }
    }

    static func count() -> Int { files().count }

    /// Soonest trip first; trips already over go last.
    static func all() -> [[String: Any]] {
        let today = ISO8601DateFormatter.day.string(from: Date())
        return files().compactMap { read($0) }.sorted { a, b in
            let (fa, fb) = (a["from"] as? String ?? "", b["from"] as? String ?? "")
            let (pa, pb) = ((a["to"] as? String ?? "") < today, (b["to"] as? String ?? "") < today)
            return pa == pb ? fa < fb : !pa
        }
    }

    static func state(_ p: [String: Any]?) -> [String: Any] {
        ["kept": p != nil, "remind": p?["remind"] as? Bool ?? false, "prayers": p?["prayers"] as? Bool ?? false]
    }
}

extension ISO8601DateFormatter {
    static let day: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        f.timeZone = .current
        return f
    }()
}

/// Local notifications for kept plans. Each notice carries its date, time
/// and the city's time zone, so a reminder fires at the right moment
/// wherever the phone is when it is set.
enum TripAlerts {
    static let prefix = "plan."

    static func set(id: String, remind: Bool, prayers: Bool, done: @escaping ([String: Any], Bool) -> Void) {
        guard var plan = TripStore.load(id) else {
            done(TripStore.state(nil), false)
            return
        }
        let finish: (Bool) -> Void = { granted in
            plan["remind"] = remind && granted
            plan["prayers"] = prayers && granted
            _ = TripStore.save(plan)
            rescheduleAll()
            done(TripStore.state(plan), granted)
        }
        guard remind || prayers else {
            finish(true)
            return
        }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            DispatchQueue.main.async { finish(granted) }
        }
    }

    static func fireDate(_ n: [String: Any]) -> Date? {
        guard let date = n["date"] as? String, let time = n["time"] as? String else { return nil }
        let d = date.split(separator: "-").compactMap { Int($0) }
        let t = time.split(separator: ":").compactMap { Int($0) }
        guard d.count == 3, t.count == 2 else { return nil }
        var cal = Calendar(identifier: .gregorian)
        if let tz = n["tz"] as? String, let zone = TimeZone(identifier: tz) { cal.timeZone = zone } else { cal.timeZone = .current }
        return cal.date(from: DateComponents(year: d[0], month: d[1], day: d[2], hour: t[0], minute: t[1]))
    }

    /// Clears ours and schedules the next 60 switched-on notices of all kept plans.
    static func rescheduleAll() {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            center.removePendingNotificationRequests(withIdentifiers: pending.map { $0.identifier }.filter { $0.hasPrefix(prefix) || $0.hasPrefix("here.") })
            let now = Date()
            var items: [(Date, UNNotificationRequest)] = []
            for plan in TripStore.all() {
                let remind = plan["remind"] as? Bool ?? false
                let prayers = plan["prayers"] as? Bool ?? false
                guard remind || prayers, let id = plan["id"] as? String,
                      let notices = plan["notices"] as? [[String: Any]] else { continue }
                for (i, n) in notices.enumerated() {
                    let isPrayer = (n["kind"] as? String) == "prayer"
                    if isPrayer ? !prayers : !remind { continue }
                    guard let at = fireDate(n), at > now.addingTimeInterval(30) else { continue }
                    let content = UNMutableNotificationContent()
                    content.title = n["title"] as? String ?? ""
                    content.body = n["body"] as? String ?? ""
                    content.sound = .default
                    content.userInfo = ["plan": id]
                    content.threadIdentifier = id
                    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: at.timeIntervalSince(now), repeats: false)
                    items.append((at, UNNotificationRequest(identifier: "\(prefix)\(id).\(i)", content: content, trigger: trigger)))
                }
            }
            // Trips get 45 of the phone's 64, prayers where you are up to 15.
            for (_, request) in items.sorted(by: { $0.0 < $1.0 }).prefix(45) { center.add(request) }
            for (_, request) in Here.notices().prefix(15) { center.add(request) }
        }
    }
}

// MARK: Screens

/// Trip mode's own screens, in the site's language and direction.
final class TripNavController: UINavigationController {
    init(target: String) {
        let dir: UISemanticContentAttribute = TripMode.english ? .forceLeftToRight : .forceRightToLeft
        UIView.appearance(whenContainedInInstancesOf: [TripNavController.self]).semanticContentAttribute = dir
        UINavigationBar.appearance(whenContainedInInstancesOf: [TripNavController.self]).semanticContentAttribute = dir
        // init(nibName:bundle:) + setViewControllers: init(rootViewController:)
        // can call back into an initializer this subclass does not have.
        super.init(nibName: nil, bundle: nil)
        setViewControllers([TripHomeController()], animated: false)
        view.semanticContentAttribute = dir
        navigationBar.semanticContentAttribute = dir
        navigationBar.tintColor = TripMode.navy
        modalPresentationStyle = .fullScreen
        go(target)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    func go(_ target: String) {
        popToRootViewController(animated: false)
        switch target {
        case "": break
        case "qibla": pushViewController(QiblaController(), animated: false)
        case "mosques": pushViewController(NearbyController(kind: .mosques), animated: false)
        case "halal": pushViewController(NearbyController(kind: .halal), animated: false)
        default:
            if let id = TripStore.cleanId(target), TripStore.load(id) != nil {
                pushViewController(PlanViewerController(id: id), animated: false)
            }
        }
    }
}

final class TripHomeController: UITableViewController {
    private var plans: [[String: Any]] = []
    private let tools: [(String, String, String)] = [
        ("qibla", "🧭", TripMode.t("اتجاه القبلة", "Qibla direction")),
        ("mosques", "🕌", TripMode.t("أقرب المساجد", "Nearest mosques")),
        ("halal", "🍽️", TripMode.t("مطاعم حلال قريبة", "Halal food nearby")),
    ]

    init() { super.init(style: .insetGrouped) }
    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = TripMode.t("وضع الرحلة", "Trip mode")
        if navigationController?.tabBarController != nil { title = TripMode.t("خططي", "My plans") }
        if navigationController?.tabBarController == nil {
            navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .close, target: self, action: #selector(close))
        }
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "tool")
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        plans = TripStore.all()
        tableView.reloadData()
    }

    @objc private func close() { dismiss(animated: true) }

    override func numberOfSections(in tableView: UITableView) -> Int { 2 }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        section == 0 ? max(plans.count, 1) : tools.count
    }

    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        section == 0 ? TripMode.t("خططي على هذا الجوال", "My plans on this phone") : TripMode.t("في الطريق", "On the go")
    }

    override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
        section == 0
            ? TripMode.t("الخطط هنا تفتح بدون إنترنت. لإضافة خطة: افتح خطة رحلتك في التطبيق واضغط «احفظ على جوالي».",
                         "Plans here open with no internet. To add one, open your trip plan in the app and tap “Keep on my phone”.")
            : TripMode.t("القبلة تعمل بدون إنترنت. البحث عن المساجد والمطاعم يحتاج اتصالاً، وتأكد من الحلال في المطعم نفسه.",
                         "The qibla works offline. Finding mosques and restaurants needs a connection; check halal at the restaurant itself.")
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
        cell.textLabel?.textAlignment = .natural
        cell.detailTextLabel?.textAlignment = .natural
        cell.textLabel?.font = .boldSystemFont(ofSize: 17)
        cell.detailTextLabel?.textColor = .secondaryLabel
        if indexPath.section == 1 {
            let tool = tools[indexPath.row]
            cell.textLabel?.text = "\(tool.1)  \(tool.2)"
            cell.accessoryType = .disclosureIndicator
            return cell
        }
        guard !plans.isEmpty else {
            cell.textLabel?.text = TripMode.t("لا توجد خطط بعد", "No plans yet")
            cell.textLabel?.textColor = .secondaryLabel
            cell.selectionStyle = .none
            return cell
        }
        let p = plans[indexPath.row]
        let bell = (p["remind"] as? Bool ?? false) || (p["prayers"] as? Bool ?? false) ? "🔔 " : ""
        cell.textLabel?.text = "🗺️  \(p["title"] as? String ?? "")"
        cell.textLabel?.numberOfLines = 2
        cell.detailTextLabel?.text = bell + (p["subtitle"] as? String ?? "")
        cell.detailTextLabel?.numberOfLines = 2
        cell.accessoryType = .disclosureIndicator
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        if indexPath.section == 1 {
            switch tools[indexPath.row].0 {
            case "qibla": navigationController?.pushViewController(QiblaController(), animated: true)
            case "mosques": navigationController?.pushViewController(NearbyController(kind: .mosques), animated: true)
            default: navigationController?.pushViewController(NearbyController(kind: .halal), animated: true)
            }
            return
        }
        guard indexPath.row < plans.count, let id = plans[indexPath.row]["id"] as? String else { return }
        navigationController?.pushViewController(PlanViewerController(id: id), animated: true)
    }

    override func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        guard indexPath.section == 0, indexPath.row < plans.count, let id = plans[indexPath.row]["id"] as? String else { return nil }
        let remove = UIContextualAction(style: .destructive, title: TripMode.t("إزالة", "Remove")) { [weak self] _, _, done in
            TripStore.remove(id)
            TripAlerts.rescheduleAll()
            self?.plans = TripStore.all()
            self?.tableView.reloadData()
            done(true)
        }
        return UISwipeActionsConfiguration(actions: [remove])
    }
}

/// A kept plan, drawn from the page the site made for it — no network.
final class PlanViewerController: UIViewController, WKNavigationDelegate {
    private let id: String
    private var web: WKWebView?

    init(id: String) {
        self.id = id
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let plan = TripStore.load(id)
        title = plan?["title"] as? String
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let wv = WKWebView(frame: view.bounds, configuration: config)
        wv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        wv.navigationDelegate = self
        view.addSubview(wv)
        web = wv
        wv.loadHTMLString(plan?["html"] as? String ?? "", baseURL: nil)
        refreshMenu()
    }

    /// Links in the plan (a place on the map) open outside: the Maps app or Safari.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // (#day links inside the page stay in the page.)
        if navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url,
           ["http", "https", "tel", "maps"].contains(url.scheme?.lowercased() ?? "") {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    private func refreshMenu() {
        guard let plan = TripStore.load(id) else { return }
        let remind = plan["remind"] as? Bool ?? false
        let prayers = plan["prayers"] as? Bool ?? false
        let notices = plan["notices"] as? [[String: Any]] ?? []
        let hasPrayers = notices.contains { ($0["kind"] as? String) == "prayer" }
        var actions: [UIMenuElement] = [
            UIAction(title: TripMode.t("ذكّرني قبل الرحلة وكل صباح", "Remind me before the trip and each morning"),
                     image: UIImage(systemName: "bell"), state: remind ? .on : .off) { [weak self] _ in
                self?.change(remind: !remind, prayers: prayers)
            },
        ]
        if hasPrayers {
            actions.append(UIAction(title: TripMode.t("أوقات الصلاة بتوقيت المدينة", "Prayer times in the city's time"),
                                    image: UIImage(systemName: "moon.stars"), state: prayers ? .on : .off) { [weak self] _ in
                self?.change(remind: remind, prayers: !prayers)
            })
        }
        let item = UIBarButtonItem(title: nil, image: UIImage(systemName: remind || prayers ? "bell.fill" : "bell"),
                                   primaryAction: nil, menu: UIMenu(title: TripMode.t("التنبيهات", "Alerts"), children: actions))
        item.accessibilityLabel = TripMode.t("التنبيهات", "Alerts")
        navigationItem.rightBarButtonItem = item
    }

    private func change(remind: Bool, prayers: Bool) {
        TripAlerts.set(id: id, remind: remind, prayers: prayers) { [weak self] _, granted in
            self?.refreshMenu()
            if !granted { self?.askForSettings() }
        }
    }

    private func askForSettings() {
        let alert = UIAlertController(title: TripMode.t("التنبيهات متوقفة", "Notifications are off"),
                                      message: TripMode.t("اسمح لسفرتنا بالتنبيهات من الإعدادات لتصلك تذكيرات رحلتك.",
                                                          "Allow Sfrtna's notifications in Settings to get your trip reminders."),
                                      preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: TripMode.t("الإعدادات", "Settings"), style: .default) { _ in
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
        })
        alert.addAction(UIAlertAction(title: TripMode.t("لاحقاً", "Later"), style: .cancel))
        present(alert, animated: true)
    }
}

/// The qibla: a needle that turns with the phone towards the Kaaba.
final class QiblaController: UIViewController, CLLocationManagerDelegate {
    private static let kaaba = CLLocation(latitude: 21.422487, longitude: 39.826206)
    private let manager = CLLocationManager()
    private let needle = UIView()
    private let arrow = UIImageView(image: UIImage(systemName: "location.north.fill"))
    private let status = UILabel()
    private let detail = UILabel()
    private let settings = UIButton(type: .system)
    private var qibla: Double?
    private var heading: Double?
    private var aligned = false
    private let feedback = UINotificationFeedbackGenerator()

    override func viewDidLoad() {
        super.viewDidLoad()
        title = TripMode.t("اتجاه القبلة", "Qibla direction")
        view.backgroundColor = .systemBackground

        let dial = UIView()
        dial.layer.cornerRadius = 140
        dial.layer.borderWidth = 2
        dial.layer.borderColor = TripMode.navy.withAlphaComponent(0.25).cgColor
        dial.backgroundColor = TripMode.navy.withAlphaComponent(0.04)
        dial.translatesAutoresizingMaskIntoConstraints = false
        needle.translatesAutoresizingMaskIntoConstraints = false
        arrow.tintColor = TripMode.navy
        arrow.contentMode = .scaleAspectFit
        arrow.translatesAutoresizingMaskIntoConstraints = false
        let kaabaMark = UILabel()
        kaabaMark.text = "🕋"
        kaabaMark.font = .systemFont(ofSize: 38)
        kaabaMark.translatesAutoresizingMaskIntoConstraints = false
        needle.addSubview(arrow)
        needle.addSubview(kaabaMark)
        dial.addSubview(needle)

        for l in [status, detail] {
            l.numberOfLines = 0
            l.textAlignment = .center
            l.translatesAutoresizingMaskIntoConstraints = false
        }
        status.font = .boldSystemFont(ofSize: 20)
        status.textColor = TripMode.navy
        detail.font = .systemFont(ofSize: 15)
        detail.textColor = .secondaryLabel
        settings.setTitle(TripMode.t("افتح الإعدادات", "Open Settings"), for: .normal)
        settings.titleLabel?.font = .boldSystemFont(ofSize: 17)
        settings.isHidden = true
        settings.translatesAutoresizingMaskIntoConstraints = false
        settings.addTarget(self, action: #selector(openSettings), for: .touchUpInside)

        view.addSubview(dial)
        view.addSubview(status)
        view.addSubview(detail)
        view.addSubview(settings)
        let g = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            dial.widthAnchor.constraint(equalToConstant: 280),
            dial.heightAnchor.constraint(equalToConstant: 280),
            dial.centerXAnchor.constraint(equalTo: g.centerXAnchor),
            dial.topAnchor.constraint(equalTo: g.topAnchor, constant: 36),
            needle.topAnchor.constraint(equalTo: dial.topAnchor),
            needle.bottomAnchor.constraint(equalTo: dial.bottomAnchor),
            needle.leadingAnchor.constraint(equalTo: dial.leadingAnchor),
            needle.trailingAnchor.constraint(equalTo: dial.trailingAnchor),
            arrow.centerXAnchor.constraint(equalTo: needle.centerXAnchor),
            arrow.centerYAnchor.constraint(equalTo: needle.centerYAnchor),
            arrow.widthAnchor.constraint(equalToConstant: 110),
            arrow.heightAnchor.constraint(equalToConstant: 110),
            kaabaMark.centerXAnchor.constraint(equalTo: needle.centerXAnchor),
            kaabaMark.topAnchor.constraint(equalTo: needle.topAnchor, constant: 10),
            status.topAnchor.constraint(equalTo: dial.bottomAnchor, constant: 32),
            status.leadingAnchor.constraint(equalTo: g.leadingAnchor, constant: 24),
            status.trailingAnchor.constraint(equalTo: g.trailingAnchor, constant: -24),
            detail.topAnchor.constraint(equalTo: status.bottomAnchor, constant: 10),
            detail.leadingAnchor.constraint(equalTo: g.leadingAnchor, constant: 24),
            detail.trailingAnchor.constraint(equalTo: g.trailingAnchor, constant: -24),
            settings.topAnchor.constraint(equalTo: detail.bottomAnchor, constant: 16),
            settings.centerXAnchor.constraint(equalTo: g.centerXAnchor),
        ])

        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.headingFilter = 1
        status.text = TripMode.t("جارٍ تحديد موقعك…", "Finding where you are…")
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        start()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        manager.stopUpdatingLocation()
        manager.stopUpdatingHeading()
    }

    private func start() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            status.text = TripMode.t("نحتاج موقعك لنعرف اتجاه القبلة", "We need your location to find the qibla")
            detail.text = TripMode.t("اسمح لسفرتنا بالموقع أثناء الاستخدام من الإعدادات. لا نحفظ موقعك ولا نرسله.",
                                     "Allow Sfrtna to use your location while using the app. It is never stored or sent.")
            settings.isHidden = false
        default:
            settings.isHidden = true
            manager.startUpdatingLocation()
            if CLLocationManager.headingAvailable() { manager.startUpdatingHeading() }
        }
    }

    @objc private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { start() }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let here = locations.last else { return }
        let p1 = here.coordinate.latitude * .pi / 180, p2 = QiblaController.kaaba.coordinate.latitude * .pi / 180
        let dl = (QiblaController.kaaba.coordinate.longitude - here.coordinate.longitude) * .pi / 180
        let bearing = atan2(sin(dl) * cos(p2), cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dl)) * 180 / .pi
        qibla = (bearing + 360).truncatingRemainder(dividingBy: 360)
        let dist = TripMode.km(here.distance(from: QiblaController.kaaba))
        detail.text = TripMode.t("القبلة على \(Int(qibla!.rounded()))° من الشمال · مكة المكرمة على بُعد \(dist)",
                                 "The qibla is \(Int(qibla!.rounded()))° from north · Makkah is \(dist) away")
        update()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        heading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        update()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if qibla == nil, manager.authorizationStatus != .denied {
            status.text = TripMode.t("تعذّر تحديد موقعك الآن، حاول في مكان مفتوح", "Could not find your location; try in the open")
        }
    }

    func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool { true }

    private func update() {
        guard let q = qibla else { return }
        guard let h = heading else {
            needle.transform = CGAffineTransform(rotationAngle: CGFloat(q * .pi / 180))
            status.text = TripMode.t("البوصلة غير متاحة؛ السهم يشير إلى القبلة إذا كان أعلى الجوال نحو الشمال",
                                     "No compass; the arrow points to the qibla when the top of the phone faces north")
            return
        }
        var diff = (q - h).truncatingRemainder(dividingBy: 360)
        if diff > 180 { diff -= 360 }
        if diff < -180 { diff += 360 }
        UIView.animate(withDuration: 0.15) {
            self.needle.transform = CGAffineTransform(rotationAngle: CGFloat(diff * .pi / 180))
        }
        let now = abs(diff) < 5
        if now != aligned {
            aligned = now
            arrow.tintColor = now ? TripMode.gold : TripMode.navy
            if now { feedback.notificationOccurred(.success) }
        }
        status.text = now
            ? TripMode.t("✓ أنت باتجاه القبلة", "✓ You are facing the qibla")
            : TripMode.t("أدِر الجوال حتى يشير السهم إلى الأعلى", "Turn the phone until the arrow points up")
    }
}

/// The nearest mosques or halal restaurants around the traveller, opening
/// walking directions in Maps.
final class NearbyController: UITableViewController, CLLocationManagerDelegate {
    enum Kind { case mosques, halal }
    private let kind: Kind
    private let manager = CLLocationManager()
    private var here: CLLocation?
    private var items: [MKMapItem] = []
    private var message: String?
    private var searching = false

    init(kind: Kind) {
        self.kind = kind
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = kind == .mosques ? TripMode.t("أقرب المساجد", "Nearest mosques") : TripMode.t("مطاعم حلال قريبة", "Halal food nearby")
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        refreshControl = UIRefreshControl()
        refreshControl?.addTarget(self, action: #selector(again), for: .valueChanged)
        begin()
    }

    @objc private func again() {
        here = nil
        begin()
    }

    private func say(_ text: String?) {
        message = text
        refreshControl?.endRefreshing()
        tableView.reloadData()
    }

    private func begin() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            say(TripMode.t("اسمح لسفرتنا بالموقع أثناء الاستخدام من الإعدادات لنجد ما حولك.",
                            "Allow Sfrtna to use your location in Settings to find what is around you."))
        default:
            say(TripMode.t("جارٍ البحث حولك…", "Looking around you…"))
            manager.requestLocation()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if here == nil, manager.authorizationStatus != .notDetermined { begin() }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard here == nil, let loc = locations.last else { return }
        here = loc
        search(around: loc)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if here == nil { say(TripMode.t("تعذّر تحديد موقعك الآن. اسحب للأسفل للمحاولة مجدداً.", "Could not find your location. Pull down to try again.")) }
    }

    private func search(around loc: CLLocation) {
        guard !searching else { return }
        searching = true
        let queries = kind == .mosques ? ["mosque", "masjid", "مسجد"] : ["halal restaurant", "halal food", "مطعم حلال"]
        let group = DispatchGroup()
        var found: [MKMapItem] = []
        for q in queries {
            group.enter()
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = q
            request.region = MKCoordinateRegion(center: loc.coordinate, latitudinalMeters: 8000, longitudinalMeters: 8000)
            request.resultTypes = .pointOfInterest
            // Food: restaurants only (no cafés, taxi ranks or shops).
            if kind == .halal { request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.restaurant]) }
            MKLocalSearch(request: request).start { response, _ in
                DispatchQueue.main.async {
                    found += response?.mapItems ?? []
                    group.leave()
                }
            }
        }
        group.notify(queue: .main) { [weak self] in
            guard let self = self else { return }
            self.searching = false
            var seen = Set<String>()
            // Search by name also returns «… Information Center», fountains,
            // museums and shops next to a mosque: not places to pray.
            let notMosque = try? NSRegularExpression(pattern: "information|center|centre|fountain|çeşme|museum|müze|shop|store|parking|otopark|hotel|otel|cafe|restaurant", options: [.caseInsensitive])
            self.items = found.filter { item in
                if self.kind == .mosques, let re = notMosque, let name = item.name,
                   re.firstMatch(in: name, range: NSRange(name.startIndex..., in: name)) != nil { return false }
                let c = item.placemark.coordinate
                let key = "\((item.name ?? "").lowercased())|\(Int(c.latitude * 2000))|\(Int(c.longitude * 2000))"
                return seen.insert(key).inserted
            }
            .sorted { self.distance($0) < self.distance($1) }
            .prefix(25)
            .map { $0 }
            self.say(self.items.isEmpty
                ? TripMode.t("لم نجد نتائج قريبة، أو لا يوجد اتصال بالإنترنت. اسحب للأسفل للمحاولة مجدداً.",
                             "Nothing found nearby, or no internet connection. Pull down to try again.")
                : nil)
        }
    }

    private func distance(_ item: MKMapItem) -> CLLocationDistance {
        guard let here = here else { return 0 }
        let c = item.placemark.coordinate
        return here.distance(from: CLLocation(latitude: c.latitude, longitude: c.longitude))
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { items.count }

    override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
        if let m = message { return m }
        return kind == .halal
            ? TripMode.t("اضغط مكاناً لتفتح الطريق إليه. تأكد من الحلال في المطعم نفسه قبل الطلب.",
                         "Tap a place for walking directions. Check halal at the restaurant itself before ordering.")
            : TripMode.t("اضغط مسجداً لتفتح الطريق إليه مشياً.", "Tap a mosque for walking directions.")
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
        let item = items[indexPath.row]
        let p = item.placemark
        let street = [p.subThoroughfare, p.thoroughfare, p.locality].compactMap { $0 }.joined(separator: " ")
        cell.textLabel?.text = item.name
        cell.textLabel?.font = .boldSystemFont(ofSize: 16)
        cell.textLabel?.textAlignment = .natural
        // Distance first; the street (often Latin) isolated so the line keeps
        // the reading direction (RLM sets it for Arabic): «350 م · street».
        let line = [TripMode.km(distance(item)), street.isEmpty ? "" : "\u{2068}\(street)\u{2069}"].filter { !$0.isEmpty }.joined(separator: " · ")
        cell.detailTextLabel?.text = (TripMode.english ? "" : "\u{200F}") + line
        cell.detailTextLabel?.textColor = .secondaryLabel
        cell.detailTextLabel?.textAlignment = .natural
        cell.accessoryType = .disclosureIndicator
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        items[indexPath.row].openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking])
    }
}

// MARK: - The app's own home: tabs («اليوم» / «خططي» / «خطّط» / «المزيد»), 16 Nov 2026
//
// App Review (4.3 / 4.2.6, PROJECT_NOTES «Apple rejection — root-cause
// study»): the app opens on its own native screen, not on the website. The
// website lives in one tab («خطّط»: city guides + the trip planner); booking
// pages never open inside the app (the site's IosTabsGuard sends them to a
// Safari sheet). Everything in «اليوم» and «خططي» works without internet.

/// The five prayers for a place and day, computed on the phone (no network).
/// Same methods as the site (guidePlan.ts prayerMethod via adhan); checked
/// against adhan to the minute for Riyadh, Istanbul, London, Dubai, Kuala
/// Lumpur (16 Nov 2026).
enum PrayerCalc {
    static let keys = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]
    /// fajr angle, isha angle, isha minutes after maghrib, and per-time minute
    /// adjustments (fajr, sunrise, dhuhr, asr, maghrib, isha) as adhan applies.
    private static func method(_ code: String) -> (Double, Double, Double, [Double]) {
        switch code {
        case "SA": return (18.5, 0, 90, [0, 0, 0, 0, 0, 0])
        case "AE": return (18.2, 18.2, 0, [0, -3, 3, 3, 3, 0])
        case "QA": return (18, 0, 90, [0, 0, 0, 0, 0, 0])
        case "KW": return (18, 17.5, 0, [0, 0, 0, 0, 0, 0])
        case "EG", "SD", "LY": return (19.5, 17.5, 0, [0, 0, 0, 0, 0, 0])
        case "TR": return (18, 17, 0, [0, -7, 5, 4, 7, 0])
        case "PK", "IN", "BD", "AF": return (18, 18, 0, [0, 0, 1, 0, 0, 0])
        case "MY", "SG", "ID", "BN": return (20, 18, 0, [0, 0, 1, 0, 0, 0])
        case "US", "CA": return (15, 15, 0, [0, 0, 1, 0, 0, 0])
        default: return (18, 17, 0, [0, 0, 1, 0, 0, 0])
        }
    }

    private static func rad(_ d: Double) -> Double { d * .pi / 180 }
    private static func deg(_ r: Double) -> Double { r * 180 / .pi }
    private static func fix(_ a: Double, _ b: Double) -> Double { let v = a - b * floor(a / b); return v < 0 ? v + b : v }

    private static func julian(_ y0: Int, _ m0: Int, _ d: Int) -> Double {
        var y = y0, m = m0
        if m <= 2 { y -= 1; m += 12 }
        let a = floor(Double(y) / 100), b = 2 - a + floor(a / 4)
        return floor(365.25 * Double(y + 4716)) + floor(30.6001 * Double(m + 1)) + Double(d) + b - 1524.5
    }

    private static func sun(_ jd: Double) -> (decl: Double, eqt: Double) {
        let d = jd - 2451545
        let g = fix(357.529 + 0.98560028 * d, 360), q = fix(280.459 + 0.98564736 * d, 360)
        let l = fix(q + 1.915 * sin(rad(g)) + 0.020 * sin(rad(2 * g)), 360)
        let e = 23.439 - 0.00000036 * d
        let ra = fix(deg(atan2(cos(rad(e)) * sin(rad(l)), cos(rad(l)))) / 15, 24)
        return (deg(asin(sin(rad(e)) * sin(rad(l)))), q / 15 - ra)
    }

    /// The times as Dates for the given calendar day at (lat, lng); nil where
    /// the sun never reaches the angle (far north in summer).
    static func times(for day: Date, lat: Double, lng: Double, country: String, zone: TimeZone = .current) -> [String: Date] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        let c = cal.dateComponents([.year, .month, .day], from: day)
        guard let y = c.year, let m = c.month, let dd = c.day,
              let midnight = cal.date(from: DateComponents(year: y, month: m, day: dd)) else { return [:] }
        let (fajrAngle, ishaAngle, ishaMinutes, adjust) = method(country)
        let jd = julian(y, m, dd) - lng / (15 * 24)
        func mid(_ t: Double) -> Double { fix(12 - sun(jd + t).eqt, 24) }
        func at(_ angle: Double, _ t: Double, _ before: Bool) -> Double? {
            let s = sun(jd + t)
            let v = (-sin(rad(angle)) - sin(rad(s.decl)) * sin(rad(lat))) / (cos(rad(s.decl)) * cos(rad(lat)))
            guard v >= -1, v <= 1 else { return nil }
            let h = deg(acos(v)) / 15
            return mid(t) + (before ? -h : h)
        }
        func asr(_ t: Double) -> Double? {
            let s = sun(jd + t)
            return at(-deg(atan(1 / (1 + tan(rad(abs(lat - s.decl)))))), t, false)
        }
        let maghrib = at(0.833, 18 / 24, false)
        let raw: [Double?] = [
            at(fajrAngle, 5 / 24, true), at(0.833, 6 / 24, true), mid(12 / 24), asr(13 / 24), maghrib,
            ishaMinutes > 0 ? maghrib.map { $0 + ishaMinutes / 60 } : at(ishaAngle, 18 / 24, false),
        ]
        let offset = Double(zone.secondsFromGMT(for: midnight)) / 3600
        var out: [String: Date] = [:]
        for (i, key) in keys.enumerated() {
            guard let h = raw[i] else { continue }
            let hours = h + offset - lng / 15 + adjust[i] / 60
            // Rounded to the minute, as the site shows them.
            let minutes = (hours * 60).rounded()
            out[key] = midnight.addingTimeInterval(minutes * 60)
        }
        return out
    }

    static func name(_ key: String) -> String {
        switch key {
        case "fajr": return TripMode.t("الفجر", "Fajr")
        case "sunrise": return TripMode.t("الشروق", "Sunrise")
        case "dhuhr": return TripMode.t("الظهر", "Dhuhr")
        case "asr": return TripMode.t("العصر", "Asr")
        case "maghrib": return TripMode.t("المغرب", "Maghrib")
        default: return TripMode.t("العشاء", "Isha")
        }
    }

    static func clock(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_GB")
        f.dateFormat = "HH:mm"
        return f.string(from: d)
    }
}

/// Where the traveller is (last known, kept on the phone only) for the
/// prayer times and «حولك». Never sent anywhere.
enum Here {
    private static let d = UserDefaults.standard
    static var lat: Double? { d.object(forKey: "here.lat") as? Double }
    static var lng: Double? { d.object(forKey: "here.lng") as? Double }
    static var country: String { d.string(forKey: "here.country") ?? (Locale.current.regionCode ?? "SA") }
    static var place: String? { d.string(forKey: "here.place") }
    static var alerts: Bool {
        get { d.bool(forKey: "here.alerts") }
        set { d.set(newValue, forKey: "here.alerts") }
    }

    static func save(_ loc: CLLocation, done: @escaping () -> Void) {
        let moved = lat.map { CLLocation(latitude: $0, longitude: lng ?? 0).distance(from: loc) > 3000 } ?? true
        d.set(loc.coordinate.latitude, forKey: "here.lat")
        d.set(loc.coordinate.longitude, forKey: "here.lng")
        guard moved || place == nil else { done(); return }
        CLGeocoder().reverseGeocodeLocation(loc, preferredLocale: Locale(identifier: TripMode.english ? "en" : "ar")) { marks, _ in
            DispatchQueue.main.async {
                if let p = marks?.first {
                    if let cc = p.isoCountryCode { d.set(cc, forKey: "here.country") }
                    d.set(p.locality ?? p.administrativeArea ?? p.country, forKey: "here.place")
                }
                done()
            }
        }
    }

    /// Prayer alerts where the traveller is: the next 3 days (15 alerts).
    static func notices() -> [(Date, UNNotificationRequest)] {
        guard alerts, let la = lat, let lo = lng else { return [] }
        var out: [(Date, UNNotificationRequest)] = []
        let now = Date()
        for i in 0..<3 {
            guard let day = Calendar.current.date(byAdding: .day, value: i, to: now) else { continue }
            for (key, at) in PrayerCalc.times(for: day, lat: la, lng: lo, country: country) where key != "sunrise" && at > now {
                let c = UNMutableNotificationContent()
                c.title = "🕌 " + PrayerCalc.name(key) + (place.map { " · \($0)" } ?? "")
                c.body = TripMode.t("حان وقت صلاة \(PrayerCalc.name(key)) (\(PrayerCalc.clock(at))).",
                                    "It is time for \(PrayerCalc.name(key)) (\(PrayerCalc.clock(at))).")
                c.sound = .default
                c.threadIdentifier = "here"
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: at.timeIntervalSince(now), repeats: false)
                out.append((at, UNNotificationRequest(identifier: "here.\(key).\(i)", content: c, trigger: trigger)))
            }
        }
        return out
    }
}

/// The app's root: four tabs, opening on «اليوم».
final class RootTabController: UITabBarController {
    let web: MainViewController
    private let todayNav = UINavigationController()
    private let plansNav = UINavigationController()
    private let moreNav = UINavigationController()

    init(web: MainViewController) {
        self.web = web
        super.init(nibName: nil, bundle: nil)
        build()
        NotificationCenter.default.addObserver(self, selector: #selector(tripModeRequest), name: TripMode.openRequest, object: nil)
        // The website loads in the background from the start (planner tab).
        web.loadViewIfNeeded()
        // CI: -sfrPath photographs a page of the site → show the planner tab.
        if ProcessInfo.processInfo.arguments.contains("-sfrPath") { selectedIndex = 2 }
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    private func build() {
        let dir: UISemanticContentAttribute = TripMode.english ? .forceLeftToRight : .forceRightToLeft
        for v in [view, tabBar] as [UIView] { v.semanticContentAttribute = dir }
        UIView.appearance(whenContainedInInstancesOf: [UINavigationController.self]).semanticContentAttribute = dir
        let look = UITabBarAppearance()
        look.configureWithOpaqueBackground()
        tabBar.standardAppearance = look
        tabBar.scrollEdgeAppearance = look
        tabBar.isTranslucent = false
        tabBar.tintColor = TripMode.navy

        todayNav.setViewControllers([TodayController()], animated: false)
        plansNav.setViewControllers([TripHomeController()], animated: false)
        moreNav.setViewControllers([MoreController()], animated: false)
        for nav in [todayNav, plansNav, moreNav] {
            nav.navigationBar.tintColor = TripMode.navy
            nav.navigationBar.prefersLargeTitles = true
            nav.view.semanticContentAttribute = dir
            nav.navigationBar.semanticContentAttribute = dir
        }
        todayNav.tabBarItem = UITabBarItem(title: TripMode.t("اليوم", "Today"), image: UIImage(systemName: "sun.max"), selectedImage: UIImage(systemName: "sun.max.fill"))
        plansNav.tabBarItem = UITabBarItem(title: TripMode.t("خططي", "My plans"), image: UIImage(systemName: "map"), selectedImage: UIImage(systemName: "map.fill"))
        web.tabBarItem = UITabBarItem(title: TripMode.t("خطّط", "Plan"), image: UIImage(systemName: "sparkles"), selectedImage: UIImage(systemName: "sparkles"))
        moreNav.tabBarItem = UITabBarItem(title: TripMode.t("المزيد", "More"), image: UIImage(systemName: "ellipsis.circle"), selectedImage: UIImage(systemName: "ellipsis.circle.fill"))
        setViewControllers([todayNav, plansNav, web, moreNav], animated: false)
        selectedIndex = 0
    }

    /// After a language change: the native tabs again, in the new language.
    func relabel() {
        let keep = selectedIndex
        build()
        selectedIndex = keep
    }

    /// Opens one of our pages in the planner tab (path like "/ar/visa").
    func openWeb(_ path: String) {
        selectedIndex = 2
        let lang = TripMode.english ? "en" : "ar"
        let full = path.hasPrefix("/") ? path : "/\(lang)/\(path)"
        if let url = URL(string: "https://sfrtna.com" + full) { web.webView?.load(URLRequest(url: url)) }
    }

    @objc private func tripModeRequest() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let target = TripMode.pending else { return }
            TripMode.pending = nil
            self.presentedViewController?.dismiss(animated: false)
            switch target {
            case "qibla", "mosques", "halal":
                self.selectedIndex = 0
                self.todayNav.popToRootViewController(animated: false)
                let next: UIViewController = target == "qibla" ? QiblaController() : NearbyController(kind: target == "mosques" ? .mosques : .halal)
                self.todayNav.pushViewController(next, animated: true)
            default:
                self.selectedIndex = 1
                self.plansNav.popToRootViewController(animated: false)
                if let id = TripStore.cleanId(target), TripStore.load(id) != nil {
                    self.plansNav.pushViewController(PlanViewerController(id: id), animated: true)
                }
            }
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if TripMode.pending != nil { tripModeRequest() }
    }
}

/// «اليوم»: where you are now — the next prayer, your trip today, and the
/// tools for the road. All of it without internet except the place name.
final class TodayController: UIViewController, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private let scroll = UIScrollView()
    private let stack = UIStackView()
    private var timer: Timer?

    override func viewDidLoad() {
        super.viewDidLoad()
        title = TripMode.t("اليوم", "Today")
        view.backgroundColor = .systemGroupedBackground
        scroll.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 8),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -24),
            stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
        ])
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        render()
        locate()
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in self?.render() }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        timer?.invalidate()
    }

    private func locate() {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: manager.requestLocation()
        default: break
        }
    }

    @objc private func askLocation() {
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        } else if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { locate() }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        Here.save(loc) { [weak self] in
            self?.render()
            TripAlerts.rescheduleAll()
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    // MARK: Drawing

    private func card(_ views: [UIView], tint: UIColor = .secondarySystemGroupedBackground, spacing: CGFloat = 8) -> UIView {
        let box = UIView()
        box.backgroundColor = tint
        box.layer.cornerRadius = 18
        let s = UIStackView(arrangedSubviews: views)
        s.axis = .vertical
        s.spacing = spacing
        s.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(s)
        NSLayoutConstraint.activate([
            s.topAnchor.constraint(equalTo: box.topAnchor, constant: 16),
            s.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -16),
            s.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 16),
            s.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -16),
        ])
        return box
    }

    private func label(_ text: String, _ font: UIFont, _ color: UIColor = .label, lines: Int = 0) -> UILabel {
        let l = UILabel()
        l.text = text
        l.font = font
        l.textColor = color
        l.numberOfLines = lines
        l.textAlignment = .natural
        return l
    }

    private func button(_ title: String, filled: Bool, action: Selector) -> UIButton {
        var config = filled ? UIButton.Configuration.filled() : UIButton.Configuration.tinted()
        config.title = title
        config.cornerStyle = .capsule
        config.baseBackgroundColor = filled ? TripMode.gold : TripMode.navy
        config.baseForegroundColor = TripMode.navy
        config.buttonSize = .large
        let b = UIButton(configuration: config)
        b.addTarget(self, action: action, for: .touchUpInside)
        return b
    }

    private func render() {
        stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        stack.addArrangedSubview(dateCard())
        stack.addArrangedSubview(prayerCard())
        stack.addArrangedSubview(tripCard())
        stack.addArrangedSubview(toolsCard())
    }

    private func dateCard() -> UIView {
        let now = Date()
        let g = DateFormatter()
        g.locale = Locale(identifier: TripMode.english ? "en_GB" : "ar_SA@calendar=gregorian;numbers=latn")
        g.calendar = Calendar(identifier: .gregorian)
        g.dateFormat = "EEEE d MMMM"
        let h = DateFormatter()
        h.locale = Locale(identifier: TripMode.english ? "en_GB" : "ar_SA@numbers=latn")
        h.calendar = Calendar(identifier: .islamicUmmAlQura)
        h.dateFormat = "d MMMM yyyy"
        let place = Here.place.map { "📍 \($0)" } ?? TripMode.t("📍 لم نحدد مكانك بعد", "📍 Location not set yet")
        return card([
            label(g.string(from: now), .boldSystemFont(ofSize: 22), .white),
            label(h.string(from: now) + TripMode.t(" هـ", " AH"), .systemFont(ofSize: 15), UIColor.white.withAlphaComponent(0.8)),
            label(place, .systemFont(ofSize: 15, weight: .semibold), TripMode.gold),
        ], tint: TripMode.navy, spacing: 4)
    }

    private func prayerCard() -> UIView {
        guard let la = Here.lat, let lo = Here.lng else {
            let b = button(TripMode.t("حدّد مكاني", "Use my location"), filled: true, action: #selector(askLocation))
            return card([
                label(TripMode.t("🕌 أوقات الصلاة حيث أنت", "🕌 Prayer times where you are"), .boldSystemFont(ofSize: 18)),
                label(TripMode.t("نحسبها على جوالك بدون إنترنت، ولا نحفظ موقعك خارج الجوال.",
                                 "Worked out on your phone, offline. Your location never leaves the phone."), .systemFont(ofSize: 14), .secondaryLabel),
                b,
            ])
        }
        let now = Date()
        let today = PrayerCalc.times(for: now, lat: la, lng: lo, country: Here.country)
        let order = PrayerCalc.keys.filter { $0 != "sunrise" }
        var next: (String, Date)? = order.compactMap { k -> (String, Date)? in today[k].map { (k, $0) } }.first { $0.1 > now }
        if next == nil, let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now),
           let f = PrayerCalc.times(for: tomorrow, lat: la, lng: lo, country: Here.country)["fajr"] { next = ("fajr", f) }
        var views: [UIView] = []
        if let n = next {
            let (k, at) = n
            let mins = Int(at.timeIntervalSince(now) / 60)
            let left = mins >= 60 ? TripMode.t("بعد \(mins / 60) س \(mins % 60) د", "in \(mins / 60)h \(mins % 60)m")
                                  : TripMode.t("بعد \(mins) دقيقة", "in \(mins) min")
            views.append(label(TripMode.t("الصلاة القادمة", "Next prayer"), .systemFont(ofSize: 14, weight: .semibold), .secondaryLabel))
            views.append(label("🕌 \(PrayerCalc.name(k))  \(PrayerCalc.clock(at))", .boldSystemFont(ofSize: 26), TripMode.navy))
            views.append(label(left, .systemFont(ofSize: 15, weight: .semibold), .systemGreen))
        }
        let row = UIStackView()
        row.axis = .horizontal
        row.distribution = .fillEqually
        row.spacing = 4
        for k in order {
            let cell = UIStackView(arrangedSubviews: [
                label(PrayerCalc.name(k), .systemFont(ofSize: 12), .secondaryLabel, lines: 1),
                label(today[k].map(PrayerCalc.clock) ?? "—", .boldSystemFont(ofSize: 15), .label, lines: 1),
            ])
            cell.axis = .vertical
            cell.alignment = .center
            cell.backgroundColor = next?.0 == k ? TripMode.gold.withAlphaComponent(0.3) : .tertiarySystemGroupedBackground
            cell.layer.cornerRadius = 10
            cell.isLayoutMarginsRelativeArrangement = true
            cell.layoutMargins = UIEdgeInsets(top: 6, left: 2, bottom: 6, right: 2)
            row.addArrangedSubview(cell)
        }
        views.append(row)
        let toggle = UISwitch()
        toggle.isOn = Here.alerts
        toggle.onTintColor = TripMode.navy
        toggle.addTarget(self, action: #selector(alertsChanged(_:)), for: .valueChanged)
        let line = UIStackView(arrangedSubviews: [label(TripMode.t("نبّهني بوقت كل صلاة حيث أنا", "Alert me at each prayer time here"), .systemFont(ofSize: 15)), toggle])
        line.axis = .horizontal
        line.spacing = 8
        line.alignment = .center
        views.append(line)
        return card(views)
    }

    @objc private func alertsChanged(_ s: UISwitch) {
        guard s.isOn else {
            Here.alerts = false
            TripAlerts.rescheduleAll()
            return
        }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { ok, _ in
            DispatchQueue.main.async {
                Here.alerts = ok
                s.setOn(ok, animated: true)
                TripAlerts.rescheduleAll()
                if !ok, let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            }
        }
    }

    /// The kept trip happening now, else the next one.
    private func tripCard() -> UIView {
        let today = ISO8601DateFormatter.day.string(from: Date())
        let plans = TripStore.all().filter { ($0["to"] as? String ?? "") >= today }
        guard let p = plans.first, let id = p["id"] as? String else {
            return card([
                label(TripMode.t("🧳 لا توجد رحلة على جوالك", "🧳 No trip on your phone yet"), .boldSystemFont(ofSize: 18)),
                label(TripMode.t("خطّط رحلتك يوماً بيوم مع أوقات الصلاة والأكل الحلال، ثم احفظها على جوالك لتفتح بدون إنترنت.",
                                 "Plan your trip day by day with prayer times and halal food, then keep it on your phone to open offline."),
                      .systemFont(ofSize: 14), .secondaryLabel),
                button(TripMode.t("خطّط رحلة", "Plan a trip"), filled: true, action: #selector(planTrip)),
            ])
        }
        let from = p["from"] as? String ?? today
        var views: [UIView] = [label("🗺️ " + (p["title"] as? String ?? ""), .boldSystemFont(ofSize: 18))]
        let f = ISO8601DateFormatter.day
        if let a = f.date(from: from), let b = f.date(from: today) {
            let n = Calendar.current.dateComponents([.day], from: b, to: a).day ?? 0
            let when = n > 0 ? TripMode.t(n == 1 ? "رحلتك غداً" : "بعد \(n) يوماً", n == 1 ? "Your trip is tomorrow" : "In \(n) days")
                             : TripMode.t("اليوم \(1 - n) من رحلتك", "Day \(1 - n) of your trip")
            views.append(label(when, .systemFont(ofSize: 15, weight: .semibold), .systemGreen))
        }
        let days = p["days"] as? [[String: Any]] ?? []
        if let d = days.first(where: { ($0["date"] as? String) == today }) {
            for s in (d["stops"] as? [[String: Any]] ?? []).prefix(6) {
                views.append(label("\(s["time"] as? String ?? "")  ·  \(s["name"] as? String ?? "")", .systemFont(ofSize: 15)))
            }
        }
        let open = button(TripMode.t("افتح الخطة", "Open the plan"), filled: true, action: #selector(openTrip))
        open.accessibilityIdentifier = id
        views.append(open)
        return card(views)
    }

    @objc private func openTrip(_ sender: UIButton) {
        if let id = sender.accessibilityIdentifier { TripMode.open(id) }
    }

    @objc private func planTrip() { (tabBarController as? RootTabController)?.openWeb("itinerary") }

    private func toolsCard() -> UIView {
        let tools: [(String, String, Selector)] = [
            ("🕋", TripMode.t("القبلة", "Qibla"), #selector(qibla)),
            ("🕌", TripMode.t("أقرب مسجد", "Nearest mosque"), #selector(mosques)),
            ("🍽️", TripMode.t("حلال قريب", "Halal nearby"), #selector(halal)),
            ("✨", TripMode.t("خطّط رحلة", "Plan a trip"), #selector(planTrip)),
        ]
        let grid = UIStackView()
        grid.axis = .vertical
        grid.spacing = 10
        for pair in stride(from: 0, to: tools.count, by: 2) {
            let row = UIStackView()
            row.axis = .horizontal
            row.spacing = 10
            row.distribution = .fillEqually
            for (icon, title, action) in tools[pair..<min(pair + 2, tools.count)] {
                var c = UIButton.Configuration.filled()
                c.title = "\(icon)  \(title)"
                c.baseBackgroundColor = .secondarySystemGroupedBackground
                c.baseForegroundColor = TripMode.navy
                c.cornerStyle = .large
                c.contentInsets = NSDirectionalEdgeInsets(top: 18, leading: 8, bottom: 18, trailing: 8)
                let b = UIButton(configuration: c)
                b.addTarget(self, action: action, for: .touchUpInside)
                row.addArrangedSubview(b)
            }
            grid.addArrangedSubview(row)
        }
        let head = label(TripMode.t("في الطريق", "On the go"), .boldSystemFont(ofSize: 18))
        let wrap = UIStackView(arrangedSubviews: [head, grid])
        wrap.axis = .vertical
        wrap.spacing = 10
        return wrap
    }

    @objc private func qibla() { navigationController?.pushViewController(QiblaController(), animated: true) }
    @objc private func mosques() { navigationController?.pushViewController(NearbyController(kind: .mosques), animated: true) }
    @objc private func halal() { navigationController?.pushViewController(NearbyController(kind: .halal), animated: true) }
}

/// «المزيد»: our pages (open in the planner tab), language, and about.
final class MoreController: UITableViewController {
    private let rows: [[(String, String)]] = [
        [("👤", "account"), ("🧳", "my-trip"), ("🛂", "visa"), ("💱", "currency"), ("🗓️", "seasons"), ("🗺️", "maps")],
        [("🌐", "lang")],
        [("ℹ️", "about"), ("✉️", "contact"), ("🔒", "privacy"), ("📄", "terms"), ("🗑️", "privacy#delete")],
    ]

    init() { super.init(style: .insetGrouped) }
    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = TripMode.t("المزيد", "More")
    }

    private func title(_ key: String) -> String {
        switch key {
        case "account": return TripMode.t("حسابي", "My account")
        case "my-trip": return TripMode.t("رحلتي: قائمة التجهيز", "My trip: checklist")
        case "visa": return TripMode.t("التأشيرات", "Visas")
        case "currency": return TripMode.t("العملات", "Currency")
        case "seasons": return TripMode.t("أفضل وقت للسفر", "Best time to travel")
        case "maps": return TripMode.t("الخرائط", "Maps")
        case "lang": return TripMode.english ? "العربية" : "English"
        case "about": return TripMode.t("عن سفرتنا", "About Sfrtna")
        case "contact": return TripMode.t("تواصل معنا", "Contact us")
        case "privacy": return TripMode.t("الخصوصية", "Privacy")
        case "terms": return TripMode.t("الشروط", "Terms")
        default: return TripMode.t("حذف حسابي وبياناتي", "Delete my account and data")
        }
    }

    override func numberOfSections(in tableView: UITableView) -> Int { rows.count }
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { rows[section].count }

    override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
        guard section == rows.count - 1 else { return nil }
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        return TripMode.t("سفرتنا \(v) (\(b)) · نخطط ونقارن، والحجز يتم لدى الشركات نفسها.",
                          "Sfrtna \(v) (\(b)) · We plan and compare; bookings are made with the companies themselves.")
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
        let (icon, key) = rows[indexPath.section][indexPath.row]
        cell.textLabel?.text = "\(icon)  \(title(key))"
        cell.textLabel?.textAlignment = .natural
        cell.accessoryType = .disclosureIndicator
        if key == "privacy#delete" { cell.textLabel?.textColor = .systemRed }
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let key = rows[indexPath.section][indexPath.row].1
        guard let tabs = tabBarController as? RootTabController else { return }
        if key == "lang" {
            TripMode.english.toggle()
            tabs.relabel()
            tabs.openWeb("/\(TripMode.english ? "en" : "ar")/itinerary")
            return
        }
        tabs.openWeb(key)
    }
}
