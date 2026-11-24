"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Apps only (owner, 24 Nov 2026: «the page moves / is cut» on his iPhone,
 * not reproducible in WebKit on the computer). After a page settles, checks
 * whether anything is wider than the phone's own screen; if so, sends ONE
 * short automatic report per page per day to our feedback inbox with the
 * elements that stick out, so the real cause on a real phone is known.
 * Nothing about the visitor is sent beyond what any feedback carries.
 */
export default function WideWatch() {
  const path = usePathname();
  useEffect(() => {
    if (!document.documentElement.classList.contains("in-app")) return;
    const key = `sfr-wide-${new Date().toISOString().slice(0, 10)}-${path}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      return;
    }
    const check = () => {
      const sw = window.screen.width;
      const layoutW = document.documentElement.clientWidth;
      const cut = (el: Element) => {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (a.tagName !== "MAIN" && s.overflowX !== "visible") return true;
          if (s.position === "fixed") return false;
        }
        return false;
      };
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || (r.right <= sw + 1 && r.left >= -1) || cut(el)) continue;
        if (out.length >= 8) break;
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") continue;
        out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 90)} [L${Math.round(r.left)} R${Math.round(r.right)} ${s.position}]`);
      }
      if (layoutW <= sw + 1 && !out.length) return;
      try {
        localStorage.setItem(key, "1");
      } catch {}
      const text = `AUTO wide-page report: screen ${sw}, page ${layoutW}, inner ${window.innerWidth}, scroll ${document.documentElement.scrollWidth}\n${out.join("\n")}`;
      fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "problem", area: "app", text, ctx: { page: location.pathname + location.search, platform: "app", device: navigator.userAgent.slice(0, 120), screen: `${sw}x${window.screen.height}`, source: "auto-wide" } }),
      }).catch(() => {});
    };
    const t = window.setTimeout(check, 4000);
    return () => window.clearTimeout(t);
  }, [path]);
  return null;
}
