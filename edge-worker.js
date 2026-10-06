// The site's Worker: OpenNext's Next.js handler, with pages kept at the edge.
//
// Every page here was rendered on each request — 0.4 s for a plain page and
// about 2 s for the seasons and visa pages, on every visit and every click
// inside the site (the in-app navigations ask the server too). Nothing on
// these pages depends on who is asking: no accounts, no cookies read. So a
// rendered page is kept in Cloudflare's own edge cache (no binding needed)
// for ten minutes, and the next visitor in that data centre gets it at once.
//
// What is kept: GET requests for pages and for the in-app navigation data
// (RSC), status 200, no Set-Cookie. What is not: /api (live prices, rates
// and the rest keep their own caching), Next's static files (served from
// assets already), and anything else. The RSC headers that change the
// answer are part of the key, so one navigation is never served another's.
//
// /api never reaches the cache: edge-guard.js checks who is asking first.
//
// Ten minutes bounds how stale anything can be — the month's season list at
// midnight on the 1st, a visa status just edited.

import handler from "./.open-next/worker.js";
import { guardApi, markApiResponse } from "./edge-guard.js";

const TTL_SECONDS = 600;

// Headers Next varies RSC responses by (see its Vary header).
const KEY_HEADERS = [
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-url",
];

function cacheable(request, url) {
  if (request.method !== "GET") return false;
  const p = url.pathname;
  if (p.startsWith("/api/") || p.startsWith("/_next/") || p.startsWith("/__")) return false;
  if (request.headers.has("next-action")) return false;
  return true;
}

async function keyFor(request, url) {
  const parts = KEY_HEADERS.map((h) => `${h}=${request.headers.get(h) ?? ""}`).join("&");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts));
  const hash = [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = new URL(url.toString());
  key.searchParams.set("__sfr_edge", hash);
  return new Request(key.toString(), { method: "GET" });
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Stored data files (public/data, e.g. each city's places) are for the
    // server only — it reads them through env.ASSETS. Never served outside.
    if (url.pathname === "/data" || url.pathname.startsWith("/data/")) {
      return new Response("Not found", { status: 404, headers: { "x-robots-tag": "noindex, nofollow" } });
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const refused = await guardApi(request, url, env);
      if (refused) return refused;
      return markApiResponse(await handler.fetch(request, env, ctx));
    }
    const cache = globalThis.caches?.default;
    if (!cache || !cacheable(request, url)) return handler.fetch(request, env, ctx);

    let key;
    try {
      key = await keyFor(request, url);
      const hit = await cache.match(key);
      if (hit) {
        const res = new Response(hit.body, hit);
        res.headers.set("x-sfr-edge", "HIT");
        return res;
      }
    } catch {
      // A cache that fails is only a slower page.
    }

    const response = await handler.fetch(request, env, ctx);
    const type = response.headers.get("content-type") || "";
    if (
      key &&
      response.status === 200 &&
      !response.headers.has("set-cookie") &&
      (type.includes("text/html") || type.includes("text/x-component"))
    ) {
      const stored = new Response(response.clone().body, response);
      stored.headers.set("cache-control", `public, max-age=${TTL_SECONDS}`);
      ctx.waitUntil(cache.put(key, stored).catch(() => {}));
      const res = new Response(response.body, response);
      res.headers.set("x-sfr-edge", "MISS");
      return res;
    }
    return response;
  },
};

export default worker;
