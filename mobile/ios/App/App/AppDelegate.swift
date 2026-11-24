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
// Sign-in: Apple (native sheet) and, since 24 Nov 2026, Google + e-mail
// through our sign-in page in Apple's sign-in sheet («auth», openAuth).
// App Store rule 4.8: Apple is offered whenever Google is.

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

    /// «iOS clean mode», backed natively (src/lib/iosClean.ts; Apple 5.1.2(i),
    /// 18 Nov 2026): whatever a page asks for, no other site's script or
    /// frame runs inside the app, and no other site's cookie is kept. Our
    /// own pages, pictures and map tiles still load; partner sites open in
    /// the Safari sheet (openOutside), which this does not touch.
    private func installNoTrackingRules() {
        guard let wv = webView else { return }
        let rules = """
        [
          {"trigger": {"url-filter": ".*", "resource-type": ["script"], "load-type": ["third-party"]}, "action": {"type": "block"}},
          {"trigger": {"url-filter": ".*", "resource-type": ["document"], "load-type": ["third-party"]}, "action": {"type": "block"}},
          {"trigger": {"url-filter": ".*", "load-type": ["third-party"]}, "action": {"type": "block-cookies"}}
        ]
        """
        WKContentRuleListStore.default()?.compileContentRuleList(
            forIdentifier: "sfrtna-no-tracking", encodedContentRuleList: rules
        ) { list, error in
            guard let list = list else {
                NSLog("Sfrtna: no-tracking rules not compiled: \(String(describing: error))")
                return
            }
            DispatchQueue.main.async { wv.configuration.userContentController.add(list) }
        }
    }

    func openOutside(_ url: URL) {
        let safari = SFSafariViewController(url: url)
        safari.preferredControlTintColor = UIColor(red: 0x0B / 255, green: 0x2D / 255, blue: 0x5B / 255, alpha: 1)
        present(safari, animated: true)
    }

    private var sidewaysWatch: NSKeyValueObservation?

    /// The page never moves sideways or zooms (owner, 24 Nov 2026: «the page
    /// moves, it is not steady» on the hotel pages). Our pages are built to
    /// fit the screen (scripts/overflow-scan.mjs checks every page in
    /// WebKit); sideways scroll rows scroll inside themselves, not the page.
    private func lockSideways() {
        guard let sv = webView?.scrollView else { return }
        sv.alwaysBounceHorizontal = false
        sv.showsHorizontalScrollIndicator = false
        sv.minimumZoomScale = 1
        sv.maximumZoomScale = 1
        sv.bouncesZoom = false
        // Always held at the page's start edge (owner's 2nd video, 24 Nov
        // 17:29: on the phone the page was still ~10 pt wider than the
        // screen, which iOS lets you pan even with overflow clipped). The
        // start is the left edge in English, the right edge in Arabic.
        sidewaysWatch = sv.observe(\.contentOffset, options: [.new]) { [weak self] sv, _ in
            let minX = -sv.adjustedContentInset.left
            let maxX = max(minX, sv.contentSize.width - sv.bounds.width + sv.adjustedContentInset.right)
            let rtl = self?.webView?.url?.path.hasPrefix("/ar") ?? true
            let target = rtl ? maxX : minX
            if abs(sv.contentOffset.x - target) > 0.5 {
                sv.contentOffset = CGPoint(x: target, y: sv.contentOffset.y)
            }
        }
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
        installNoTrackingRules()
        installSafeArea()
        lockSideways()
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
                TripMode.english = english
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
            ? "🧭 خططك المحفوظة على الجوال (\(kept))"
            : "🧭 Your plans on this phone (\(kept))", for: .normal)
        trip.isHidden = kept == 0
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
        CAPPluginMethod(name: "addToCalendar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appleSignIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAuth", returnType: CAPPluginReturnPromise),
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
        if let host = url.host?.lowercased(), SfrtnaAppPlugin.ourHosts.contains(host), !SfrtnaAppPlugin.isOutLink(url) {
            return NSNumber(value: false)
        }
        DispatchQueue.main.async { [weak self] in
            (self?.bridge?.viewController as? MainViewController)?.openOutside(url)
        }
        return NSNumber(value: true)
    }

    @objc func info(_ call: CAPPluginCall) {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        call.resolve(["platform": "ios", "version": version, "features": ["share", "share-binary", "print", "trip-mode", "haptics", "calendar", "apple", "auth"]])
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
        var plan: [String: Any] = [
            "id": id, "title": text("title"), "subtitle": text("subtitle"),
            "from": text("from"), "to": text("to"), "lang": text("lang"),
            "html": html, "notices": notices,
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

    /// «أضف الخطة إلى تقويم جوالي» (16 Nov 2026): every stop as an event in
    /// the phone's calendar, at its time in the city's own time zone, with an
    /// alert 30 minutes before. Asks for calendar access only now (iOS 17:
    /// add-only access, the app never reads the calendar).
    @objc func addToCalendar(_ call: CAPPluginCall) {
        let items: [JSObject] = (call.getArray("events") ?? []).prefix(300).compactMap { $0 as? JSObject }
        let store = EKEventStore()
        let done: (Bool) -> Void = { granted in
            guard granted else { call.resolve(["added": 0, "granted": false]); return }
            let day = DateFormatter()
            day.locale = Locale(identifier: "en_US_POSIX")
            day.calendar = Calendar(identifier: .gregorian)
            day.dateFormat = "yyyy-MM-dd HH:mm"
            var added = 0
            for o in items {
                guard let date = o["date"] as? String, let time = o["time"] as? String, let title = o["title"] as? String else { continue }
                day.timeZone = (o["tz"] as? String).flatMap { TimeZone(identifier: $0) } ?? .current
                let hm = time.count == 4 ? "0" + time : time
                guard let start = day.date(from: "\(date.prefix(10)) \(hm.prefix(5))") else { continue }
                let minutes = (o["minutes"] as? NSNumber)?.doubleValue ?? 60
                let ev = EKEvent(eventStore: store)
                ev.title = String(title.prefix(200))
                ev.startDate = start
                ev.endDate = start.addingTimeInterval(max(15, min(minutes, 360)) * 60)
                ev.timeZone = day.timeZone
                ev.location = (o["place"] as? String).map { String($0.prefix(300)) }
                ev.notes = (o["notes"] as? String).map { String($0.prefix(1000)) }
                if let lat = (o["lat"] as? NSNumber)?.doubleValue, let lon = (o["lon"] as? NSNumber)?.doubleValue {
                    let loc = EKStructuredLocation(title: ev.location ?? ev.title)
                    loc.geoLocation = CLLocation(latitude: lat, longitude: lon)
                    ev.structuredLocation = loc
                }
                ev.addAlarm(EKAlarm(relativeOffset: -30 * 60))
                ev.calendar = store.defaultCalendarForNewEvents
                if (try? store.save(ev, span: .thisEvent, commit: false)) != nil { added += 1 }
            }
            try? store.commit()
            DispatchQueue.main.async { UINotificationFeedbackGenerator().notificationOccurred(.success) }
            call.resolve(["added": added, "granted": true])
        }
        if #available(iOS 17.0, *) {
            store.requestWriteOnlyAccessToEvents { granted, _ in done(granted) }
        } else {
            store.requestAccess(to: .event) { granted, _ in done(granted) }
        }
    }

    /// «تسجيل الدخول عبر Apple» (16 Nov 2026): Apple's own sheet; the page
    /// sends the identity token to /api/auth/apple, which checks it against
    /// the nonce the page made (Apple gets only its SHA-256).
    @objc func appleSignIn(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), nonce.count >= 16 else { call.reject("bad_nonce"); return }
        DispatchQueue.main.async {
            AppleSignIn.start(nonce: nonce, window: self.bridge?.viewController?.view.window) { token, name, code, error in
                if let token = token {
                    var out: [String: Any] = ["idToken": token]
                    if let name = name, !name.isEmpty { out["name"] = name }
                    if let code = code, !code.isEmpty { out["code"] = code }
                    call.resolve(out)
                } else {
                    call.reject(error ?? "apple_failed")
                }
            }
        }
    }

    /// «المتابعة بحساب Google» in the iPhone app (owner, 24 Nov 2026: iPhone
    /// users may use every way, not only Apple). Google refuses its sign-in
    /// inside the app's WebView, so our own sign-in page opens in Apple's
    /// secure sign-in sheet (ASWebAuthenticationSession); it ends at
    /// sfrtna://auth?code=…, and the account page trades that code, with the
    /// verifier only this app holds, for the app's session — the same round
    /// trip as Android's Custom Tab (src/lib/appAuth.ts).
    @objc func openAuth(_ call: CAPPluginCall) {
        let raw = call.getString("url") ?? ""
        guard raw.range(of: "^https://sfrtna\\.com/(ar|en)/account/app\\?c=[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil,
              let url = URL(string: raw) else {
            call.reject("bad_url")
            return
        }
        DispatchQueue.main.async {
            WebSignIn.start(url: url, window: self.bridge?.viewController?.view.window) { [weak self] back in
                guard let back = back, back.scheme == "sfrtna", back.host == "auth",
                      let items = URLComponents(url: back, resolvingAgainstBaseURL: false)?.queryItems,
                      let code = items.first(where: { $0.name == "code" })?.value,
                      code.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { return }
                let lang = items.first(where: { $0.name == "lang" })?.value == "en" ? "en" : "ar"
                if let page = URL(string: "https://sfrtna.com/\(lang)/account?app_code=\(code)") {
                    self?.bridge?.webView?.load(URLRequest(url: page))
                }
            }
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
import EventKit
import MapKit

enum TripMode {
    /// The language the visitor last used on the site (set from the
    /// sfrtna_lang cookie at launch), else the phone's.
    static var english = !(Locale.preferredLanguages.first?.hasPrefix("ar") ?? true)
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
            center.removePendingNotificationRequests(withIdentifiers: pending.map { $0.identifier }.filter { $0.hasPrefix(prefix) })
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
            for (_, request) in items.sorted(by: { $0.0 < $1.0 }).prefix(60) { center.add(request) }
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
    // Owner 16 Nov 18:23: iPhone extras = kept plans + alerts + calendar only;
    // the qibla and nearby lists stay in the code, not on screen.
    private let tools: [(String, String, String)] = []
    private let hiddenTools: [(String, String, String)] = [
        ("qibla", "🧭", TripMode.t("اتجاه القبلة", "Qibla direction")),
        ("mosques", "🕌", TripMode.t("أقرب المساجد", "Nearest mosques")),
        ("halal", "🍽️", TripMode.t("مطاعم حلال قريبة", "Halal food nearby")),
    ]

    init() { super.init(style: .insetGrouped) }
    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = TripMode.t("وضع الرحلة", "Trip mode")
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .close, target: self, action: #selector(close))
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "tool")
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        plans = TripStore.all()
        tableView.reloadData()
    }

    @objc private func close() { dismiss(animated: true) }

    override func numberOfSections(in tableView: UITableView) -> Int { tools.isEmpty ? 1 : 2 }

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

// MARK: - Sign in with Apple (16 Nov 2026)

import AuthenticationServices
import CryptoKit

final class AppleSignIn: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private static var current: AppleSignIn?
    private let window: UIWindow?
    private let done: (String?, String?, String?, String?) -> Void

    private init(window: UIWindow?, done: @escaping (String?, String?, String?, String?) -> Void) {
        self.window = window
        self.done = done
    }

    static func start(nonce: String, window: UIWindow?, done: @escaping (String?, String?, String?, String?) -> Void) {
        let me = AppleSignIn(window: window, done: done)
        current = me
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = me
        controller.presentationContextProvider = me
        controller.performRequests()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        window ?? UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.windows.first { $0.isKeyWindow } }.first ?? UIWindow()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = cred.identityToken, let token = String(data: data, encoding: .utf8) else {
            finish(nil, nil, nil, "no_token")
            return
        }
        let name = cred.fullName.map { PersonNameComponentsFormatter().string(from: $0) }
        // One-time code: the server swaps it for a refresh token, so deleting
        // the account can revoke it at Apple (guideline 5.1.1(v)).
        let code = cred.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        finish(token, name, code, nil)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let cancelled = (error as? ASAuthorizationError)?.code == .canceled
        finish(nil, nil, nil, cancelled ? "cancelled" : "apple_failed")
    }

    private func finish(_ token: String?, _ name: String?, _ code: String?, _ error: String?) {
        done(token, name, code, error)
        AppleSignIn.current = nil
    }
}

// MARK: - Signing in on our page in Apple's sign-in sheet (24 Nov 2026)

final class WebSignIn: NSObject, ASWebAuthenticationPresentationContextProviding {
    private static var current: WebSignIn?
    private let window: UIWindow?
    private var session: ASWebAuthenticationSession?

    private init(window: UIWindow?) {
        self.window = window
    }

    static func start(url: URL, window: UIWindow?, done: @escaping (URL?) -> Void) {
        current?.session?.cancel()
        let me = WebSignIn(window: window)
        current = me
        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "sfrtna") { back, _ in
            DispatchQueue.main.async {
                done(back)
                WebSignIn.current = nil
            }
        }
        session.presentationContextProvider = me
        // Shares Safari's sign-ins, so Google can list the phone's accounts.
        session.prefersEphemeralWebBrowserSession = false
        me.session = session
        if !session.start() {
            done(nil)
            current = nil
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        window ?? UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.windows.first { $0.isKeyWindow } }.first ?? UIWindow()
    }
}
