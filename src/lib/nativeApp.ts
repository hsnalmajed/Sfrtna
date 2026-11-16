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

import type { OfflinePlan } from "@/lib/tripMode";

const APP_UA = /SfrtnaApp\/(Android|iOS)/;

interface SfrtnaAppPlugin {
  shareFile(options: { name: string; mimeType: string; content: string; encoding?: "base64" }): Promise<void>;
  print(options: { title: string }): Promise<void>;
  info(): Promise<{ platform: string; version: string; features?: string[] }>;
  /** Opens our sign-in page in the phone's browser (Custom Tab); app builds from 21 Oct 2026. */
  openAuth(options: { url: string }): Promise<void>;
  /** Google's own silent sign-in on the phone (Credential Manager); app builds from 21 Oct 2026. */
  googleSilent(options: { clientId: string }): Promise<{ idToken: string }>;
  googleSignOut(): Promise<void>;
  /** «وضع الرحلة» (iPhone builds from 16 Nov 2026, feature «trip-mode»). */
  keepPlan(options: OfflinePlan): Promise<AppPlanState>;
  forgetPlan(options: { id: string }): Promise<AppPlanState>;
  planState(options: { id: string }): Promise<AppPlanState>;
  setAlerts(options: { id: string; remind: boolean; prayers: boolean }): Promise<AppPlanState & { granted: boolean }>;
  openTripMode(options: { target?: string }): Promise<void>;
  haptic(options: { kind: "success" | "light" }): Promise<void>;
}

/** A plan kept on the phone, and its alert switches. */
export interface AppPlanState {
  kept: boolean;
  remind: boolean;
  prayers: boolean;
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

/**
 * A picture (the plan's route image) to the phone's share sheet: save to the
 * gallery, send on WhatsApp. Needs an app build with «share-binary» (14 Nov
 * 2026); false → the caller tries the browser's own share, then a download.
 */
export async function shareImageInApp(name: string, blob: Blob): Promise<boolean> {
  return shareBlobInApp(name, blob, "image/png");
}

/** Can this app build hand a binary file (picture, PDF) to the share sheet? */
export async function appCanShareFiles(): Promise<boolean> {
  return plugin() !== null && (await appFeatures()).includes("share-binary");
}

/**
 * Any binary file (the plan's PDF, 16 Nov 2026) to the phone's share sheet:
 * save to Files, send on WhatsApp. Same «share-binary» build as the picture.
 */
export async function shareBlobInApp(name: string, blob: Blob, fallbackType = "application/octet-stream"): Promise<boolean> {
  const app = plugin();
  if (!app || !(await appFeatures()).includes("share-binary")) return false;
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    await app.shareFile({ name, mimeType: blob.type || fallbackType, content: base64, encoding: "base64" });
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

// ── «وضع الرحلة» (16 Nov 2026) ────────────────────────────────────────────
// The phone keeps a plan that opens with no internet, its reminders and
// prayer alerts (local notifications), the qibla and the nearest mosques /
// halal food. Only app builds whose `features` include «trip-mode».

/** The id the app keeps a plan under: one per city (or route) and dates. */
export function offlinePlanId(code: string, slug: string, from: string, to: string, route = false): string {
  return `${route ? "r" : "c"}-${code}-${slug}-${from}-${to}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
}

/** Does this app build have trip mode? */
export async function tripModeInApp(): Promise<boolean> {
  return plugin() !== null && (await appFeatures()).includes("trip-mode");
}

async function tripCall<R>(run: (app: SfrtnaAppPlugin) => Promise<R>): Promise<R | null> {
  const app = plugin();
  if (!app || !(await tripModeInApp())) return null;
  try {
    return await run(app);
  } catch (e) {
    // «full»: 30 plans kept already. Anything else: treat as not done.
    if (e && typeof e === "object" && "message" in e && String((e as { message: unknown }).message).includes("full")) throw new Error("full");
    return null;
  }
}

export const keepPlanInApp = (plan: OfflinePlan) => tripCall((app) => app.keepPlan(plan));
export const forgetPlanInApp = (id: string) => tripCall((app) => app.forgetPlan({ id }));
export const planStateInApp = (id: string) => tripCall((app) => app.planState({ id }));
export const setPlanAlertsInApp = (id: string, remind: boolean, prayers: boolean) => tripCall((app) => app.setAlerts({ id, remind, prayers }));

/** target: "qibla" | "mosques" | "halal" | a kept plan's id | undefined (the list). */
export async function openTripModeInApp(target?: string): Promise<boolean> {
  return (await tripCall((app) => app.openTripMode({ target: target ?? "" }).then(() => true))) === true;
}

/** A light tap / a success buzz, where the app can (no-op elsewhere). */
export function hapticInApp(kind: "success" | "light" = "light"): void {
  const app = plugin();
  if (!app) return;
  void appFeatures().then((f) => {
    if (f.includes("haptics")) app.haptic({ kind }).catch(() => {});
  });
}
