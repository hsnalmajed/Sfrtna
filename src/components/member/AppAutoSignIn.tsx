"use client";

import { useEffect } from "react";
import { refreshAccount, useAccount } from "@/lib/useAccount";
import { googleSilentInApp, inApp } from "@/lib/nativeApp";
import { track } from "@/lib/analytics";

/**
 * Opening the app signs a member in by itself (owner, 21 Oct):
 *  - a session made in the app lasts while the app is used (renewed on
 *    every visit, accounts.js);
 *  - on a phone whose Google account already signed in to Sfrtna (site or
 *    app), Google's own silent sign-in hands the app a token with no screen
 *    — once per launch, never after the traveller signed out on purpose.
 * Renders nothing.
 */
export default function AppAutoSignIn() {
  const account = useAccount();
  const google = account.methods.google;
  const signedOut = account.status === "ready" && !account.user;
  useEffect(() => {
    if (!signedOut || !google || !inApp()) return;
    try {
      if (window.localStorage.getItem("sfr-no-auto") || window.sessionStorage.getItem("sfr-auto-tried")) return;
      window.sessionStorage.setItem("sfr-auto-tried", "1");
    } catch {
      return;
    }
    let live = true;
    void googleSilentInApp(google).then(async (idToken) => {
      if (!live || !idToken) return;
      const res = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: idToken }) });
      if (res.ok) {
        track("login", { method: "google_auto" });
        await refreshAccount();
      }
    });
    return () => {
      live = false;
    };
  }, [signedOut, google]);
  return null;
}
