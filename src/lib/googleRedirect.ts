/** Google's redirect sign-in (see src/app/api/auth/google/start). */
export const GOOGLE_NONCE_COOKIE = "sfr_gnonce";
/** The app's PKCE challenge while it signs in with Google (src/lib/appAuth.ts). */
export const GOOGLE_APP_COOKIE = "sfr_gapp";

/**
 * The address Google sends its answer to. It must be listed, exactly, under
 * «Authorized redirect URIs» of the web OAuth client in Google Cloud.
 */
export const googleRedirectUri = (origin: string): string => `${origin}/api/auth/google/return`;

/**
 * Back into the app after Google: iPhone → sfrtna://auth (Apple's sign-in
 * sheet catches it); Android → an intent: link to our app, with the app's
 * sign-in page as the fallback if Chrome will not open it.
 */
export function appReturnUrl(code: string, lang: string, userAgent: string, fallback: string): string {
  const query = `code=${code}&lang=${lang}`;
  if (/Android/i.test(userAgent))
    return `intent://auth?${query}#Intent;scheme=sfrtna;package=com.sfrtna.app;S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
  return `sfrtna://auth?${query}`;
}
