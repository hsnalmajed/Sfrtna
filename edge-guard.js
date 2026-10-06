// Who may call /api, and how often.
//
// Every /api route answers the site's own pages: fares under the date
// picker, a hotel's prices, the suggest-a-destination list, an itinerary.
// Left open, the same routes are a ready-made feed for anyone who wants our
// data in bulk — and three of them spend money or a monthly allowance on
// each call (SerpApi hotel prices, the Anthropic itinerary, the Overpass and
// Travelpayouts fan-out behind discover). So before Next sees an /api
// request, the edge checks three things:
//
//   1. The route is one the site actually uses. Old routes no page calls
//      (/api/flights, /api/hotels) answer 404 here; their code is untouched.
//   2. The request comes from one of our own pages. Browsers say so
//      themselves (Sec-Fetch-Site, then Origin, then Referer); a script
//      that sends none of them is turned away. The redirect out to Expedia
//      is a link, so any click may use it; the two owner status pages may
//      also be opened by typing their address.
//   3. The same address is not asking faster than a person could. Two
//      Cloudflare rate-limit bindings (wrangler.jsonc), counted per IP per
//      Cloudflare location: a generous one for every route, a tighter one
//      for the routes that cost. Generous because mobile carriers put many
//      people behind one address.
//
// A header can be forged, so this does not stop a determined scraper on its
// own — it removes the easy path, and Cloudflare's bot settings and these
// limits handle the rest. If a binding is missing (local preview) the limit
// is skipped rather than the site broken.

/** @typedef {"page" | "link" | "owner"} Caller */
/** @typedef {{ methods: string[], caller: Caller, heavy?: boolean }} Rule */

/** @type {Record<string, Rule>} */
const ROUTES = {
  "/api/day-fares": { methods: ["GET"], caller: "page" },
  "/api/destination-photos": { methods: ["GET"], caller: "page" },
  "/api/hotel-suggest": { methods: ["GET"], caller: "page" },
  "/api/rates": { methods: ["GET"], caller: "page" },
  "/api/origin": { methods: ["GET"], caller: "page" },
  "/api/live-fare": { methods: ["GET"], caller: "page" },
  "/api/discover": { methods: ["GET"], caller: "page", heavy: true },
  "/api/multicity": { methods: ["GET"], caller: "page", heavy: true },
  "/api/country-places": { methods: ["GET"], caller: "page", heavy: true },
  "/api/hotel-prices": { methods: ["GET"], caller: "page", heavy: true },
  "/api/itinerary": { methods: ["POST"], caller: "page", heavy: true },
  "/api/go/expedia": { methods: ["GET"], caller: "link" },
  "/api/health": { methods: ["GET"], caller: "owner", heavy: true },
  "/api/serp-status": { methods: ["GET"], caller: "owner" },
};

function sameOrigin(value, origin) {
  try {
    return new URL(value).origin === origin;
  } catch {
    return false;
  }
}

/** Did one of our own pages make this request? */
function fromOurPage(request, origin) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const o = request.headers.get("origin");
  if (o) return o === origin;
  const ref = request.headers.get("referer");
  if (ref) return sameOrigin(ref, origin);
  return false;
}

/** Our page, or the address typed into the browser's own bar. */
function fromOurPageOrTyped(request, origin) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "none") return request.headers.get("sec-fetch-mode") === "navigate";
  return fromOurPage(request, origin);
}

function deny(status, error, extra = {}) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      ...extra,
    },
  });
}

async function overLimit(binding, key) {
  if (!binding || typeof binding.limit !== "function") return false;
  try {
    const { success } = await binding.limit({ key });
    return !success;
  } catch {
    return false; // A limiter that fails must not take the site down with it.
  }
}

/**
 * null → let the request through; a Response → answer with it instead.
 * @param {Request} request
 * @param {URL} url
 * @param {{ API_LIMIT?: { limit: Function }, API_LIMIT_HEAVY?: { limit: Function } }} env
 */
export async function guardApi(request, url, env) {
  const path = url.pathname.replace(/\/+$/, "");
  const rule = ROUTES[path];
  if (!rule) return deny(404, "not_found");

  const method = request.method === "HEAD" ? "GET" : request.method;
  if (method === "OPTIONS") return deny(405, "method_not_allowed");
  if (!rule.methods.includes(method)) {
    return deny(405, "method_not_allowed", { allow: rule.methods.join(", ") });
  }

  const allowed =
    rule.caller === "link" ||
    (rule.caller === "owner" ? fromOurPageOrTyped(request, url.origin) : fromOurPage(request, url.origin));
  if (!allowed) return deny(403, "forbidden");

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (await overLimit(env?.API_LIMIT, ip)) return deny(429, "too_many_requests", { "retry-after": "60" });
  if (rule.heavy && (await overLimit(env?.API_LIMIT_HEAVY, ip))) {
    return deny(429, "too_many_requests", { "retry-after": "60" });
  }
  return null;
}

/** Nothing under /api belongs in a search index. */
export function markApiResponse(response) {
  const res = new Response(response.body, response);
  res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
}
