"""Agoda Hotel Data File (English + Arabic) -> the site's Agoda data bundle.

Run by agoda-data.yml: python3 -I build-bundle.py <EN.csv> <AR.csv> <out>
Out (copied into public/data/agoda/ at release, served to our server only):
  tiles/<lat>_<lng>.json   every Agoda hotel in the 1-degree squares around our
                           cities: [id, cityId, lat, lng, name, stars] (id match)
  cities.json              {slug: [agoda city ids]} for the city search
  city/<slug>.json         EVERY Agoda hotel of the city, most reviewed first:
                           [id, name, nameAr, stars, rating/10, reviews, lat,
                            lng, photo, type, shard]
  hotel/<slug>/<shard>.json  {id: details} 100 hotels a file: photos, address,
                           overview (en/ar), check-in/out, rooms, years, chain
  report.txt / stats.json  per city counts
A city's hotels = Agoda's own city id(s) for the place (those holding >= 15%
of the hotels within 15 km of our centre) plus anything within 8 km.
"""
import csv, json, math, os, re, sys
from collections import Counter, defaultdict

en_csv, ar_csv, out = sys.argv[1], sys.argv[2], sys.argv[3]
OVERVIEW_MAX = int(os.environ.get("OVERVIEW_MAX", "700"))
csv.field_size_limit(10**8)

body = open("src/data/cityCoords.ts", encoding="utf-8").read().split("CITY_COORDS", 1)[1].split("LANDMARK_COORDS", 1)[0]
cities = {m.group(1): (float(m.group(2)), float(m.group(3)))
          for m in re.finditer(r'"([a-z0-9-]+)":\s*\{\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)', body)}

tile = lambda la, lo: f"{math.floor(la)}_{math.floor(lo)}"
by_tile = defaultdict(list)
for slug, (la, lo) in cities.items():
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            by_tile[tile(la + dy, lo + dx)].append(slug)

def km(a, b, c, d):
    p = math.pi / 180
    return 6371 * math.hypot((d - b) * p * math.cos((a + c) * p / 2), (c - a) * p)

def num(v, f=float):
    try:
        return f(v) if v not in ("", None) else 0
    except ValueError:
        return 0

PHOTO = re.compile(r"^https?://pix\d*\.agoda\.net/hotel[iI]mages/", re.I)
def photo(u):
    u = (u or "").strip()
    if not PHOTO.match(u):
        return ""
    return PHOTO.sub("", u).split("?")[0]

def cut(text, n):
    t = re.sub(r"\s+", " ", (text or "")).strip()
    if len(t) <= n:
        return t
    t = t[:n]
    i = max(t.rfind(". "), t.rfind("۔ "), t.rfind("، "))
    return (t[: i + 1] if i > n * 0.5 else t.rsplit(" ", 1)[0] + "…").strip()

# Arabic file first: names, address and overview by hotel id.
ar = {}
with open(ar_csv, encoding="utf-8-sig", newline="") as f:
    for r in csv.DictReader(f):
        try:
            la, lo = float(r["latitude"]), float(r["longitude"])
        except (ValueError, KeyError):
            continue
        if tile(la, lo) not in by_tile:
            continue
        name = (r.get("hotel_translated_name") or "").strip()
        has_ar = re.search(r"[؀-ۿ]", name)
        ar[r["hotel_id"]] = (name if has_ar else "", cut(r.get("overview"), OVERVIEW_MAX) if re.search(r"[؀-ۿ]", r.get("overview") or "") else "",
                             (r.get("addressline1") or "").strip() if re.search(r"[؀-ۿ]", r.get("addressline1") or "") else "")
print("AGODA arabic rows kept:", len(ar), "with arabic name:", sum(1 for v in ar.values() if v[0]))

tiles = defaultdict(list)
near = defaultdict(Counter)
hotels = {}  # id -> row dict
with open(en_csv, encoding="utf-8-sig", newline="") as f:
    for r in csv.DictReader(f):
        try:
            la, lo = float(r["latitude"]), float(r["longitude"])
            hid, cid = int(r["hotel_id"]), int(r["city_id"] or 0)
        except (ValueError, KeyError):
            continue
        t = tile(la, lo)
        if t not in by_tile or not (la or lo):
            continue
        name = r["hotel_name"].strip()
        stars = num(r["star_rating"])
        tiles[t].append([hid, cid, round(la, 5), round(lo, 5), name, stars])
        for slug in by_tile[t]:
            cla, clo = cities[slug]
            if abs(cla - la) < 0.2 and abs(clo - lo) < 0.25 and km(cla, clo, la, lo) <= 15:
                near[slug][cid] += 1
        a = ar.get(r["hotel_id"], ("", "", ""))
        hotels[hid] = {
            "cid": cid, "la": round(la, 5), "lo": round(lo, 5), "name": name, "ar": a[0], "stars": stars,
            "rating": round(num(r["rating_average"]), 1), "reviews": int(num(r["number_of_reviews"], int)),
            "type": (r.get("accommodation_type") or "").strip(),
            "photos": [p for p in (photo(r.get(f"photo{i}")) for i in range(1, 6)) if p],
            "addr": ", ".join(x for x in [(r.get("addressline1") or "").strip(), (r.get("city") or "").strip()] if x),
            "addrAr": a[2], "ov": cut(r.get("overview"), OVERVIEW_MAX), "ovAr": a[1],
            "in": (r.get("checkin") or "").strip(), "out": (r.get("checkout") or "").strip(),
            "rooms": int(num(r.get("numberrooms"), int)), "opened": (r.get("yearopened") or "").strip(),
            "renov": (r.get("yearrenovated") or "").strip(), "chain": (r.get("chain_name") or "").strip(),
            "brand": (r.get("brand_name") or "").strip(), "zip": (r.get("zipcode") or "").strip(),
        }
del ar

os.makedirs(f"{out}/tiles", exist_ok=True)
for t, rows in tiles.items():
    json.dump(rows, open(f"{out}/tiles/{t}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# Which Agoda city ids are each of our cities.
city_ids = {}
for slug, c in near.items():
    total = sum(c.values())
    city_ids[slug] = sorted(cid for cid, n in c.items() if cid and n >= 0.15 * total) or [c.most_common(1)[0][0]]
json.dump(city_ids, open(f"{out}/cities.json", "w"), separators=(",", ":"), sort_keys=True)

by_cid = defaultdict(list)
for hid, h in hotels.items():
    by_cid[h["cid"]].append(hid)

os.makedirs(f"{out}/city", exist_ok=True)
lines, stats = [], {}
for slug, (cla, clo) in sorted(cities.items()):
    ids = set()
    for cid in city_ids.get(slug, []):
        ids.update(by_cid[cid])
    for t in {tile(cla + dy, clo + dx) for dy in (-0.1, 0, 0.1) for dx in (-0.1, 0, 0.1)}:
        for row in tiles.get(t, []):
            if km(cla, clo, row[2], row[3]) <= 8:
                ids.add(row[0])
    order = sorted(ids, key=lambda i: (-hotels[i]["reviews"], -hotels[i]["rating"], i))
    rows, shards = [], defaultdict(dict)
    for n, hid in enumerate(order):
        h, shard = hotels[hid], n // 100
        rows.append([hid, h["name"], h["ar"], h["stars"], h["rating"], h["reviews"], h["la"], h["lo"],
                     h["photos"][0] if h["photos"] else "", h["type"], shard])
        shards[shard][hid] = {k: h[k] for k in ("photos", "addr", "addrAr", "ov", "ovAr", "in", "out", "rooms",
                                                 "opened", "renov", "chain", "brand", "zip") if h[k]}
    if not rows:
        lines.append(f"{slug}\t0")
        continue
    json.dump(rows, open(f"{out}/city/{slug}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    os.makedirs(f"{out}/hotel/{slug}", exist_ok=True)
    for s, d in shards.items():
        json.dump(d, open(f"{out}/hotel/{slug}/{s}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    with_ar = sum(1 for r in rows if r[2])
    stats[slug] = {"hotels": len(rows), "arabic": with_ar, "ids": city_ids.get(slug, [])}
    lines.append(f"{slug}\t{len(rows)}\tar {with_ar}\tids {city_ids.get(slug)}")
open(f"{out}/report.txt", "w", encoding="utf-8").write("\n".join(lines) + "\n")
json.dump(stats, open(f"{out}/stats.json", "w"), separators=(",", ":"))
print("AGODA cities with hotels:", len(stats), "/", len(cities), "hotels listed:", sum(s["hotels"] for s in stats.values()),
      "with arabic name:", sum(s["arabic"] for s in stats.values()))
