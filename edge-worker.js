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
// Freshness (8 Oct 2026, the app felt slow): a page younger than FRESH
// seconds is served as is; an older one is still served at once, and a new
// copy is rendered in the background for the next visitor (stale while
// revalidate), for up to KEEP seconds. With little traffic, a ten-minute
// lifetime meant nearly every tap waited on a fresh render. The key carries
// the deployment's version id, so a new deploy never serves pages that point
// at the previous build's scripts. What a stale page can lag by is bounded
// by FRESH plus one visit: the month's season list on the 1st, a visa edit.
//
// Browsers and the app's WebView get "no-cache": they ask every time (the
// edge answers at once) and never hold a page past a deploy.

import handler from "./.open-next/worker.js";
import { guardApi, markApiResponse } from "./edge-guard.js";

const FRESH_SECONDS = 3600;
const KEEP_SECONDS = 7 * 24 * 3600;

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

async function keyFor(request, url, env) {
  const version = env?.CF_VERSION_METADATA?.id ?? "";
  const parts = `v=${version}&` + KEY_HEADERS.map((h) => `${h}=${request.headers.get(h) ?? ""}`).join("&");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts));
  const hash = [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = new URL(url.toString());
  key.searchParams.set("__sfr_edge", hash);
  return new Request(key.toString(), { method: "GET" });
}

function storable(response) {
  const type = response.headers.get("content-type") || "";
  return (
    response.status === 200 &&
    !response.headers.has("set-cookie") &&
    (type.includes("text/html") || type.includes("text/x-component"))
  );
}

async function store(cache, key, response) {
  const stored = new Response(response.body, response);
  stored.headers.set("cache-control", `public, max-age=${KEEP_SECONDS}`);
  stored.headers.set("x-sfr-stored", String(Date.now()));
  await cache.put(key, stored);
}

async function refresh(cache, key, request, env, ctx) {
  const response = await handler.fetch(new Request(request), env, ctx);
  if (storable(response)) await store(cache, key, response);
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // The Worker's own address (*.workers.dev) is not behind the zone's bot
    // protection, so left open it is a side door around everything the
    // site's Cloudflare settings refuse — and a second copy of every page for
    // search engines. Everyone is sent to sfrtna.com, except the site check
    // (scripts/smoke.mjs) carrying the SMOKE_TOKEN secret.
    if (url.hostname.endsWith(".workers.dev")) {
      const token = env?.SMOKE_TOKEN;
      if (!token || request.headers.get("x-sfrtna-smoke") !== token) {
        return Response.redirect(`https://sfrtna.com${url.pathname}${url.search}`, 301);
      }
    }
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
      key = await keyFor(request, url, env);
      const hit = await cache.match(key);
      if (hit) {
        const age = (Date.now() - Number(hit.headers.get("x-sfr-stored") || 0)) / 1000;
        // Older than FRESH: still answer now, and render a new copy for the
        // next visitor while this one is already reading.
        if (age > FRESH_SECONDS) ctx.waitUntil(refresh(cache, key, request, env, ctx).catch(() => {}));
        const res = new Response(hit.body, hit);
        res.headers.set("x-sfr-edge", age > FRESH_SECONDS ? "STALE" : "HIT");
        res.headers.set("cache-control", "private, no-cache");
        res.headers.delete("x-sfr-stored");
        return res;
      }
    } catch {
      // A cache that fails is only a slower page.
    }

    const response = await handler.fetch(request, env, ctx);
    if (key && storable(response)) {
      ctx.waitUntil(store(cache, key, response.clone()).catch(() => {}));
      const res = new Response(response.body, response);
      res.headers.set("x-sfr-edge", "MISS");
      return res;
    }
    return response;
  },
};

export default worker;
