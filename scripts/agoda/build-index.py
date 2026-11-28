"""Agoda Hotel Data File -> our small indexes (run by agoda-data.yml).

Input: the partner CSV (argv[1]), our city centres (src/data/cityCoords.ts).
Output (argv[2]):
  tiles/<lat>_<lng>.json  every Agoda hotel in the 1-degree squares around our
                          cities: [hotelId, cityId, lat, lng, name, stars]
                          -> lets the server find the Agoda id of a hotel it
                          already shows (by place + name).
  cities.json             {slug: agoda cityId} -> the city search; the city id
                          most hotels within 15 km of the centre carry.
  report.txt              per city: chosen id, its name, hotel count, share.
"""
import csv, json, math, os, re, sys
from collections import Counter, defaultdict

src, out = sys.argv[1], sys.argv[2]
coords_ts = open("src/data/cityCoords.ts", encoding="utf-8").read()
body = coords_ts.split("CITY_COORDS", 1)[1].split("LANDMARK_COORDS", 1)[0]
cities = {
    m.group(1): (float(m.group(2)), float(m.group(3)))
    for m in re.finditer(r'"([a-z0-9-]+)":\s*\{\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)', body)
}
print("AGODA cities in coords:", len(cities))

tile = lambda la, lo: f"{math.floor(la)}_{math.floor(lo)}"
wanted = set()
by_tile = defaultdict(list)  # tile -> cities whose 15 km circle may reach it
for slug, (la, lo) in cities.items():
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            wanted.add(tile(la + dy, lo + dx))
            by_tile[tile(la + dy, lo + dx)].append(slug)

def km(a, b, c, d):
    p = math.pi / 180
    x = (d - b) * p * math.cos((a + c) * p / 2)
    y = (c - a) * p
    return 6371 * math.hypot(x, y)

tiles = defaultdict(list)
near = defaultdict(Counter)  # slug -> Counter(cityId)
cname = {}
csv.field_size_limit(10**8)
with open(src, encoding="utf-8-sig", newline="") as f:
    for r in csv.DictReader(f):
        try:
            la, lo = float(r["latitude"]), float(r["longitude"])
            hid, cid = int(r["hotel_id"]), int(r["city_id"] or 0)
        except (ValueError, KeyError):
            continue
        if not (la or lo):
            continue
        t = tile(la, lo)
        if t not in wanted:
            continue
        try:
            stars = float(r["star_rating"] or 0)
        except ValueError:
            stars = 0
        tiles[t].append([hid, cid, round(la, 5), round(lo, 5), r["hotel_name"].strip(), stars])
        cname.setdefault(cid, f'{r["city"]}, {r["country"]}')
        for slug in by_tile[t]:
            cla, clo = cities[slug]
            if abs(cla - la) < 0.2 and abs(clo - lo) < 0.25 and km(cla, clo, la, lo) <= 15:
                near[slug][cid] += 1

os.makedirs(f"{out}/tiles", exist_ok=True)
total = 0
for t, rows in tiles.items():
    total += len(rows)
    with open(f"{out}/tiles/{t}.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
city_ids, lines = {}, []
for slug in sorted(cities):
    c = near.get(slug)
    if not c:
        lines.append(f"{slug}\tNONE")
        continue
    cid, n = c.most_common(1)[0]
    city_ids[slug] = cid
    lines.append(f"{slug}\t{cid}\t{cname.get(cid)}\t{n}/{sum(c.values())}")
json.dump(city_ids, open(f"{out}/cities.json", "w"), indent=0, sort_keys=True)
open(f"{out}/report.txt", "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("AGODA tiles:", len(tiles), "hotels:", total, "cities mapped:", len(city_ids), "/", len(cities))
