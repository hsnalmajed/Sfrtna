"use client";

import { useSyncExternalStore } from "react";

// True inside the phone app (html.in-app, set by the layout before the first
// paint). For the few places where CSS alone can't switch the look — a
// component that takes a light/dark tone as a prop. False on the server and
// during hydration, then the real answer: the website's look first, never
// a hydration mismatch.

function subscribe(onChange: () => void) {
  const watch = new MutationObserver(onChange);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => watch.disconnect();
}

export function useInApp(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("in-app"),
    () => false
  );
}
