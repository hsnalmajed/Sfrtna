/**
 * The site running inside the Sfrtna phone app (mobile/ — Capacitor).
 *
 * The app shows sfrtna.com itself, so almost nothing here differs from the
 * browser. Two buttons do: a WebView cannot save a downloaded file or print
 * a page, so inside the app those go to the phone's share sheet and print
 * screen instead (mobile/android/.../SfrtnaAppPlugin.java).
 *
 * The app adds "SfrtnaApp/Android" to its user agent; Capacitor puts its
 * bridge on window only for pages on sfrtna.com. Both must be present
 * before a call goes native — anything else falls back to the browser way.
 */

const APP_UA = /SfrtnaApp\/(Android|iOS)/;

interface SfrtnaAppPlugin {
  shareFile(options: { name: string; mimeType: string; content: string }): Promise<void>;
  print(options: { title: string }): Promise<void>;
  info(): Promise<{ platform: string; version: string; features?: string[] }>;
  /** Opens our sign-in page in the phone's browser (Custom Tab); app builds from 21 Oct 2026. */
  openAuth(options: { url: string }): Promise<void>;
  /** Google's own silent sign-in on the phone (Credential Manager); app builds from 21 Oct 2026. */
  googleSilent(options: { clientId: string }): Promise<{ idToken: string }>;
  googleSignOut(): Promise<void>;
}

declare global {
  interface Window {
    Capacitor?: { Plugins?: { SfrtnaApp?: SfrtnaAppPlugin } };
  }
}

/** "android_app" / "ios_app" inside the app, "web" everywhere else. */
export function appPlatform(): "android_app" | "ios_app" | "web" {
  if (typeof navigator === "undefined") return "web";
  const m = APP_UA.exec(navigator.userAgent);
  if (!m) return "web";
  return m[1] === "iOS" ? "ios_app" : "android_app";
}

function plugin(): SfrtnaAppPlugin | null {
  if (typeof window === "undefined" || appPlatform() === "web") return null;
  return window.Capacitor?.Plugins?.SfrtnaApp ?? null;
}

/** True when the app's native buttons are there to call. */
export function inApp(): boolean {
  return plugin() !== null;
}

/** Hand a file to the phone's share sheet. False → do it the browser way. */
export async function shareFileInApp(name: string, mimeType: string, content: string): Promise<boolean> {
  const app = plugin();
  if (!app) return false;
  try {
    await app.shareFile({ name, mimeType, content });
    return true;
  } catch {
    return false;
  }
}

/** Open the phone's print / save-as-PDF screen. False → window.print(). */
export async function printInApp(title: string): Promise<boolean> {
  const app = plugin();
  if (!app) return false;
  try {
    await app.print({ title });
    return true;
  } catch {
    return false;
  }
}

/** The site's print / "save as PDF" buttons: the app's print screen, else the browser's. */
export function printPage(title?: string): void {
  if (!inApp()) {
    window.print();
    return;
  }
  void printInApp(title || document.title).then((done) => {
    if (!done) window.print();
  });
}

let featuresAsk: Promise<string[]> | null = null;
/** What this build of the app can do natively ([] on the site or an old build). */
export function appFeatures(): Promise<string[]> {
  const app = plugin();
  if (!app) return Promise.resolve([]);
  featuresAsk ??= app
    .info()
    .then((i) => (Array.isArray(i.features) ? i.features : []))
    .catch(() => []);
  return featuresAsk;
}

/** Open a page of ours in the phone's browser, for signing in. */
export async function openAuthInApp(url: string): Promise<boolean> {
  const app = plugin();
  if (!app || !(await appFeatures()).includes("auth")) return false;
  try {
    await app.openAuth({ url });
    return true;
  } catch {
    return false;
  }
}

/** A Google ID token without any screen, when this phone's Google account already signed in to us. */
export async function googleSilentInApp(clientId: string): Promise<string | null> {
  const app = plugin();
  if (!app || !(await appFeatures()).includes("google")) return null;
  try {
    return (await app.googleSilent({ clientId })).idToken || null;
  } catch {
    return null;
  }
}

export async function googleSignOutInApp(): Promise<void> {
  const app = plugin();
  if (!app || !(await appFeatures()).includes("google")) return;
  try {
    await app.googleSignOut();
  } catch {
    /* nothing to clear */
  }
}
