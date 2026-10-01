/**
 * Where the visitor has been on this site, in this tab — so a "back" button
 * can take them to the page they actually came from rather than a fixed one.
 *
 * A stack of in-site paths in sessionStorage, kept by <NavTracker /> in the
 * layout: a new page is pushed; returning to the page before (the browser's
 * back, or ours) pops. sessionStorage is per tab and can be unavailable
 * (private modes); every access is guarded and the fallback is the fixed
 * link the page already had.
 */
const KEY = "sfrtna:nav";

export function readStack(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const EVENT = "sfrtna:nav";

function writeStack(stack: string[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-50)));
  } catch {
    // Nothing to remember with; back buttons use their fixed link.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Calls `onChange` whenever the history is updated (for useSyncExternalStore). */
export function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Record that `path` is now showing. `fresh`: a full page load from outside the site. */
export function recordVisit(path: string, fresh: boolean): void {
  if (fresh) {
    writeStack([path]);
    return;
  }
  const stack = readStack();
  if (stack[stack.length - 1] === path) {
    window.dispatchEvent(new Event(EVENT));
    return;
  }
  if (stack[stack.length - 2] === path) {
    stack.pop();
  } else {
    stack.push(path);
  }
  writeStack(stack);
}

/** True when the page showing (`path`) was reached from another page on this site. */
export function hasPreviousPage(path: string): boolean {
  const stack = readStack();
  return stack.length >= 2 && stack[stack.length - 1] === path;
}
