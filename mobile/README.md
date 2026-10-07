# Sfrtna phone apps

The apps are **sfrtna.com in a native shell**, built with Capacitor 8.
The site loads live from `https://sfrtna.com` (`capacitor.config.json →
server.url`). Nothing from the site is copied into the app, so a change on the
site reaches the app the moment it is deployed. Only the shell needs a new
store release.

## Why a shell and not a separate app

- **One product.** Prices, partners, the flight widget, the Stay22 map and
  analytics are the site's own. The "live price or nothing" rule holds
  without a second copy of the code.
- **The /api guard is unchanged.** The page runs on `https://sfrtna.com`
  inside the WebView. Its `fetch()` calls are ordinary same-origin requests
  with `Sec-Fetch-Site: same-origin`, so `edge-guard.js` treats them like any
  browser. Capacitor proxies page loads natively only on WebViews too old to
  support document-start scripts. Those requests are HTML pages, never
  `/api`. No app-only API route exists, and none should be added without
  adding it to `ROUTES` in `edge-guard.js`.
- **No ads.** No ad SDK, and the advertising-ID permission is removed
  explicitly in `AndroidManifest.xml`.

## What the Android shell adds (`android/app/src/main/java/com/sfrtna/app/`)

| File | Job |
|---|---|
| `MainActivity` | Launch screen held until the first page draws (max 6 s); back button walks back through pages, then leaves; offline screen that retries by itself when the network returns |
| `AppWebViewClient` | Our pages stay in the app. Another site opened in the page (partner, visa office) opens in a **Custom Tab** over the app. Navigation inside an embedded widget stays in the widget. `tel:` `mailto:` `whatsapp:` `intent:` go to their apps |
| `AppChromeClient` | `target="_blank"` and `window.open()` (ours or a widget's) → Custom Tab, or the app for our own pages |
| `SfrtnaAppPlugin` | `shareFile` (KML/GPX → share sheet) and `print` (Android print / save as PDF), called by the site through `src/lib/nativeApp.ts` |
| `OfflineView` | The "no connection" screen (Arabic default, English on English phones) |

Inside the app the site wears app chrome — bottom tab bar, slim header, no
footer — chosen by CSS under `html.in-app` (see the end of
`src/app/globals.css` and `src/components/AppTabBar.tsx`). Changing it is a
site change: no new app release.

The site knows it is inside the app from the user agent suffix
`SfrtnaApp/Android`. GA4 receives it as the user property `app_platform`
(`android_app` / `web`).

## Building

The cloud workspace cannot download the Android SDK, so builds run on
GitHub Actions (`.github/workflows/android.yml`). The workflow runs on every
push that touches `mobile/`, or by hand from the Actions tab.

- **Test APK**: attached to the `android-test` pre-release on GitHub. Open it on
  the phone, download `sfrtna-android-test.apk`, and allow installing from
  the browser once.
- **Play bundle (.aab)**: built only when the upload-key secrets exist (see
  the workflow header). The key never enters the repository.

Locally, with Android Studio installed: `npm ci && npm run android:debug`.

## Still to do before Google Play

1. Google Play developer account (owner).
2. Upload key: create it on the owner's computer, then add it as the four
   repository secrets. Use Play App Signing.
3. App Links: after the first upload, put Play's app-signing SHA-256 in
   `/.well-known/assetlinks.json` on the site and add an `autoVerify`
   intent filter, so sfrtna.com links open in the app.
4. Store listing: screenshots, short and long description (ar + en), privacy
   policy URL, Data safety form (no data sold, analytics only with consent,
   approximate/precise location only on tap, no ads).
