/** Google's redirect sign-in (see src/app/api/auth/google/start). */
export const GOOGLE_NONCE_COOKIE = "sfr_gnonce";

/**
 * The address Google sends its answer to. It must be listed, exactly, under
 * «Authorized redirect URIs» of the web OAuth client in Google Cloud.
 */
export const googleRedirectUri = (origin: string): string => `${origin}/api/auth/google/return`;
