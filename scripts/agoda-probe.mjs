// Agoda direct, site check only (agoda-probe.yml): per city, how many shown
// hotels got an Agoda id and Agoda's live rate beside Google's Agoda price.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 sfrtna-site-check";
const BASE = process.env.BASE;
const headers = {
  "User-Agent": UA,
  "x-sfrtna-smoke": process.env.SMOKE_TOKEN || "",
  Origin: BASE,
  Referer: `${BASE}/ar/hotel-results`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  Accept: "application/json",
  // 4 paid hotel searches, on purpose (the check spends nothing otherwise).
  "x-sfrtna-spend": "1",
};
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
for (const city of (process.env.CITIES || "Riyadh,Jeddah,Dubai,Istanbul").split(",")) {
  const qs = new URLSearchParams({ q: `hotels in ${city}`, checkIn: day(21), checkOut: day(23), adults: "2", agoda: "1" });
  const r = await fetch(`${BASE}/api/hotel-prices?${qs}`, { headers }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
  console.log("AGODA " + JSON.stringify({ city, n: r.result?.hotels?.length ?? 0, err: r.error, via: r.check?.via, agoda: r.check?.agoda }));
}

// The full Agoda list of a city (bundle + live rates) and the name search.
const get = (path) => fetch(`${BASE}${path}`, { headers }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
const dates = `checkIn=${day(21)}&checkOut=${day(23)}&adults=2`;
for (const [city, q] of [["riyadh", ""], ["riyadh", "ميرال"], ["dubai", "hilton"], ["makkah", ""], ["madinah", ""]]) {
  const r = await get(`/api/agoda-hotels?city=${city}&${dates}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const h = r.result?.hotels ?? [];
  console.log("AGODA LIST " + JSON.stringify({ city, q, total: r.result?.total, matching: r.result?.matching, ratesOk: r.result?.ratesOk, priced: h.filter((x) => x.perNight).length, of: h.length, top: h.slice(0, 3).map((x) => [x.nameAr || x.name, x.rating, x.reviews, x.perNight, x.photo ? "photo" : "-"]), err: r.error }));
  if (h[0]) {
    const d = await get(`/api/agoda-hotel?city=${city}&shard=${h[0].shard}&id=${h[0].id}`);
    console.log("AGODA HOTEL " + JSON.stringify({ city, photos: d.result?.photos?.length, ar: Boolean(d.result?.overviewAr), en: Boolean(d.result?.overview), addr: d.result?.addressAr || d.result?.address }));
  }
}
for (const q of ["ميرال كراون", "Meral Crown", "هيلتون دبي"]) {
  const r = await get(`/api/hotel-suggest?q=${encodeURIComponent(q)}`);
  console.log("AGODA SUGGEST " + JSON.stringify({ q, n: r.items?.length, first: (r.items ?? []).slice(0, 3).map((x) => x.nameAr || x.name) }));
}
