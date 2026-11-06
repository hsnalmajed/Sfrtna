// Does Google's answer for ONE hotel carry room types? (owner, 7 Nov 2026:
// "check before any promise"). Two searches on the given Worker: a city
// list for a hotel id, then that hotel afresh with `probe=1` — the answer
// lists the field names that mention rooms (no values, no key).
//   BASE=https://sfrtna-staging.almajedhsn.workers.dev SMOKE_TOKEN=… node scripts/hotel-probe.mjs
const BASE = process.env.BASE || "https://sfrtna-staging.almajedhsn.workers.dev";
const headers = { "x-sfrtna-smoke": process.env.SMOKE_TOKEN || "", "user-agent": "sfrtna-site-check" };
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const dates = { checkIn: day(30), checkOut: day(33), adults: "2" };
for (const city of (process.env.CITIES || "Dubai, United Arab Emirates|Istanbul, Turkey").split("|")) {
  const list = await fetch(`${BASE}/api/hotel-prices?${new URLSearchParams({ q: city, ...dates })}`, { headers }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  const hotels = list?.result?.hotels ?? [];
  const h = hotels.find((x) => x.token);
  console.log(`PROBE ${city}: list ${hotels.length} hotels; ids ${hotels.filter((x) => x.token).length}; offers on first ${h?.offers?.length ?? 0}`);
  if (!h) continue;
  const one = await fetch(`${BASE}/api/hotel-prices?${new URLSearchParams({ q: `${h.name} ${city}`, token: h.token, probe: "1", ...dates })}`, { headers }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  const r = one?.result;
  const x = r?.hotels?.[0];
  console.log(`PROBE ${h.name}: kind ${r?.kind}; offers ${x?.offers?.length ?? 0}; images ${x?.images?.length ?? 0}; rooms ${x?.rooms?.length ?? 0}`);
  for (const line of r?.shape ?? ["no shape (token not accepted?)"]) console.log(`PROBE   ${line}`);
  for (const room of (x?.rooms ?? []).slice(0, 6)) console.log(`PROBE   room: ${room.source} | ${room.name} | guests ${room.guests} | photo ${room.image ? "yes" : "no"} | total ${room.total}`);
}
