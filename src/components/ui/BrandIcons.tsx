/**
 * The marks of the stores and social networks we link to (owner, 27 Oct:
 * "logos, like every other site, not names"). Drawn inline — no outside
 * request, no font. Each is only ever a link to our own listing/profile.
 */
type P = { className?: string };

export function AppleIcon({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export function GooglePlayIcon({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#00d7fe" d="M3.6 1.8 13.8 12 3.6 22.2c-.3-.2-.5-.6-.5-1.1V2.9c0-.5.2-.9.5-1.1z" />
      <path fill="#00f076" d="M3.6 1.8c.4-.3 1-.3 1.6 0l12.1 6.8-3.5 3.4z" />
      <path fill="#ff3a44" d="M3.6 22.2 13.8 12l3.5 3.4-12.1 6.8c-.6.3-1.2.3-1.6 0z" />
      <path fill="#ffd500" d="m17.3 8.6 3.4 1.9c1.1.6 1.1 2.4 0 3l-3.4 1.9-3.5-3.4z" />
    </svg>
  );
}

export function InstagramIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

export function SnapchatIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.2c2.9 0 5.2 2.2 5.2 5.1 0 .9-.1 1.9-.1 2.6.4.2 1 .1 1.5-.1.5-.2 1 .2.9.7-.1.5-.8.8-1.6 1.1-.4.1-.6.4-.5.8.6 1.6 1.9 2.9 3.6 3.4.5.1.6.6.2.9-.6.4-1.5.6-2.3.7-.2.4-.2 1-.6 1.2-.5.2-1.2-.1-2.1 0-1.2.2-2 1.5-4.2 1.5s-3-1.3-4.2-1.5c-.9-.1-1.6.2-2.1 0-.4-.2-.4-.8-.6-1.2-.8-.1-1.7-.3-2.3-.7-.4-.3-.3-.8.2-.9 1.7-.5 3-1.8 3.6-3.4.1-.4-.1-.7-.5-.8-.8-.3-1.5-.6-1.6-1.1-.1-.5.4-.9.9-.7.5.2 1.1.3 1.5.1 0-.7-.1-1.7-.1-2.6C6.8 4.4 9.1 2.2 12 2.2z" />
    </svg>
  );
}

export function XIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}
