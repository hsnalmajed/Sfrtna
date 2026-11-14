/**
 * «صورة المسار» (owner's friend, 14 Nov 2026: «a picture of the trip like a
 * tour map — the country, the stops, the lines»): the plan drawn on a map as
 * one portrait image (1080×1350, the size phones and stories show whole).
 *
 *   - map: OpenStreetMap tiles (the same the site's maps use), lightly
 *     washed so the route stands out; credited in the corner as required;
 *   - a route across cities: each city a big marker with its days, joined in
 *     order, the way home dashed; every stop a small dot in its city's colour;
 *   - one city: each day its own colour, its stops numbered and joined;
 *   - a header with the title and dates, a legend, and sfrtna.com.
 * Drawn on a canvas in the browser: Arabic is shaped by the browser itself.
 * Loaded only on click. Tiles that fail leave plain land colour, never an error.
 */

export interface ImageStop {
  lat: number;
  lon: number;
  day: number;
  /** City of the route (index into cities), or 0. */
  city: number;
  /** The kind of place as an icon, and its name (the footer lists each city's best). */
  icon?: string;
  name?: string;
}

export interface ImageCity {
  name: string;
  lat: number;
  lon: number;
  label: string;
  dayTrip?: boolean;
}

export interface PlanImageInput {
  title: string;
  subtitle: string;
  stops: ImageStop[];
  /** Two or more: drawn as a route across cities. */
  cities: ImageCity[];
  dayLabel: (n: number) => string;
  rtl: boolean;
}

const W = 1080;
const H = 1350;
const HEAD = 200;
const FOOT_ONE = 150;
/** Room each route city takes in the footer (its line of places). */
const FOOT_LINE = 50;
const COLORS = ["#e11d48", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#b45309", "#9333ea", "#16a34a"];
const NAVY = "#0b1b33";
const SUN = "#fbbf24";
const FONT = '"Tajawal", "IBM Plex Sans Arabic", system-ui, sans-serif';

const lon2x = (lon: number, z: number) => ((lon + 180) / 360) * 256 * 2 ** z;
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256 * 2 ** z;
};

async function tile(z: number, x: number, y: number): Promise<ImageBitmap | null> {
  const n = 2 ** z;
  const xx = ((x % n) + n) % n;
  if (y < 0 || y >= n) return null;
  try {
    const res = await fetch(`https://tile.openstreetmap.org/${z}/${xx}/${y}.png`, { mode: "cors" });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Text that never runs past maxW: shrinks, then cuts with an ellipsis. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight: number, min = 18): string {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && s > min) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
  let out = text;
  while (ctx.measureText(out).width > maxW && out.length > 4) out = `${out.slice(0, -2)}…`;
  return out;
}

export async function drawPlanImage(input: PlanImageInput): Promise<Blob> {
  // Make sure the site's fonts are ready for the canvas.
  try {
    await Promise.all([document.fonts.load(`800 40px ${FONT}`), document.fonts.load(`500 24px ${FONT}`)]);
  } catch {
    // System fonts then.
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.direction = input.rtl ? "rtl" : "ltr";
  const multi = input.cities.length >= 2;

  // ── Map frame: fit every point (and city) with a margin ─────────────
  const pts = [...input.stops.map((s) => ({ lat: s.lat, lon: s.lon })), ...input.cities.map((c) => ({ lat: c.lat, lon: c.lon }))];
  const mapX = 0;
  const mapY = HEAD;
  const mapW = W;
  const FOOT = multi ? 80 + FOOT_LINE * Math.min(5, input.cities.length) : FOOT_ONE;
  const mapH = H - HEAD - FOOT;
  const pad = 90;
  let z = 16;
  const box = (zz: number) => {
    const xs = pts.map((p) => lon2x(p.lon, zz));
    const ys = pts.map((p) => lat2y(p.lat, zz));
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  while (z > 3) {
    const b = box(z);
    if (b.x1 - b.x0 <= mapW - pad * 2 && b.y1 - b.y0 <= mapH - pad * 2) break;
    z--;
  }
  const b = box(z);
  // Between two zoom levels: the tiles are drawn larger so the route fills the frame.
  const sc = Math.max(1, Math.min(1.9, (mapW - pad * 2) / Math.max(1, b.x1 - b.x0), (mapH - pad * 2) / Math.max(1, b.y1 - b.y0)));
  const cx = ((b.x0 + b.x1) / 2) * sc;
  const cy = ((b.y0 + b.y1) / 2) * sc;
  const left = cx - mapW / 2;
  const top = cy - mapH / 2;
  const T = 256 * sc;
  const px = (lat: number, lon: number) => ({ x: mapX + lon2x(lon, z) * sc - left, y: mapY + lat2y(lat, z) * sc - top });

  // Land colour under the tiles, then the tiles.
  ctx.fillStyle = "#eef2ef";
  ctx.fillRect(mapX, mapY, mapW, mapH);
  const tx0 = Math.floor(left / T);
  const ty0 = Math.floor(top / T);
  const tx1 = Math.floor((left + mapW) / T);
  const ty1 = Math.floor((top + mapH) / T);
  const jobs: Promise<void>[] = [];
  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapW, mapH);
  ctx.clip();
  for (let tx = tx0; tx <= tx1; tx++)
    for (let ty = ty0; ty <= ty1; ty++)
      jobs.push(
        tile(z, tx, ty).then((img) => {
          if (img) ctx.drawImage(img, mapX + tx * T - left, mapY + ty * T - top, T + 0.5, T + 0.5);
        }),
      );
  await Promise.all(jobs);
  // A light wash: the route reads first, the map second.
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillRect(mapX, mapY, mapW, mapH);

  const colorOf = (s: ImageStop) => COLORS[(multi ? s.city : s.day) % COLORS.length];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (multi) {
    // The way between cities, in order; the way home dashed.
    const cps = input.cities.map((c) => px(c.lat, c.lon));
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 7;
    ctx.beginPath();
    cps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([16, 14]);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cps[cps.length - 1].x, cps[cps.length - 1].y);
    ctx.lineTo(cps[0].x, cps[0].y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrow heads half-way along each leg.
    for (let i = 1; i < cps.length; i++) {
      const a = cps[i - 1];
      const c = cps[i];
      const ang = Math.atan2(c.y - a.y, c.x - a.x);
      const mx = (a.x + c.x) / 2;
      const my = (a.y + c.y) / 2;
      ctx.fillStyle = NAVY;
      ctx.beginPath();
      ctx.moveTo(mx + Math.cos(ang) * 16, my + Math.sin(ang) * 16);
      ctx.lineTo(mx + Math.cos(ang + 2.5) * 16, my + Math.sin(ang + 2.5) * 16);
      ctx.lineTo(mx + Math.cos(ang - 2.5) * 16, my + Math.sin(ang - 2.5) * 16);
      ctx.fill();
    }
    // Stops: the kind of place as an icon in a white disc ringed in its
    // city's colour; one that would sit on another is left out.
    const drawn: { x: number; y: number }[] = cps.map((p) => ({ x: p.x, y: p.y }));
    for (const s of input.stops) {
      const p = px(s.lat, s.lon);
      if (drawn.some((d) => Math.hypot(d.x - p.x, d.y - p.y) < 40)) continue;
      drawn.push(p);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = colorOf(s);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `20px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = NAVY;
      ctx.fillText(s.icon ?? "📍", p.x, p.y + 1);
    }
    // Cities: numbered markers; the name card where it covers the fewest stops.
    const cards: { x: number; y: number; w: number; h: number }[] = [];
    input.cities.forEach((c, i) => {
      const p = cps[i];
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `900 30px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), p.x, p.y + 2);
      const name = fitText(ctx, c.name, 300, 32, 800);
      const nameW = ctx.measureText(name).width;
      ctx.font = `500 22px ${FONT}`;
      // Generous sides: Arabic final letters (ي ى) reach past their own width.
      const lw = Math.max(nameW, ctx.measureText(c.label).width) + 56;
      const lh = 84;
      const spots = [
        { x: p.x + 44, y: p.y - lh / 2 },
        { x: p.x - 44 - lw, y: p.y - lh / 2 },
        { x: p.x - lw / 2, y: p.y - 44 - lh },
        { x: p.x - lw / 2, y: p.y + 44 },
      ];
      const cost = (r: { x: number; y: number }) => {
        let n = 0;
        if (r.x < 12 || r.x + lw > W - 12 || r.y < mapY + 12 || r.y + lh > mapY + mapH - 40) n += 1000;
        for (const d of drawn) if (d.x > r.x - 20 && d.x < r.x + lw + 20 && d.y > r.y - 20 && d.y < r.y + lh + 20) n += 10;
        for (const k of cards) if (r.x < k.x + k.w && r.x + lw > k.x && r.y < k.y + k.h && r.y + lh > k.y) n += 500;
        return n;
      };
      const at = spots.reduce((best, r) => (cost(r) < cost(best) ? r : best), spots[0]);
      const lx = Math.min(Math.max(at.x, 12), W - 12 - lw);
      const ly = Math.min(Math.max(at.y, mapY + 12), mapY + mapH - 40 - lh);
      cards.push({ x: lx, y: ly, w: lw, h: lh });
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      roundRect(ctx, lx, ly, lw, lh, 18);
      ctx.fill();
      ctx.fillStyle = NAVY;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `800 32px ${FONT}`;
      ctx.fillText(name, lx + lw / 2, ly + 40);
      ctx.font = `500 22px ${FONT}`;
      ctx.fillStyle = "#475569";
      ctx.fillText(c.label, lx + lw / 2, ly + 70);
    });
  } else {
    // One city: each day's stops joined, numbered within the day.
    const byDay = new Map<number, ImageStop[]>();
    for (const s of input.stops) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    for (const [, list] of byDay) {
      const c = colorOf(list[0]);
      ctx.strokeStyle = c;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      list.forEach((s, i) => {
        const p = px(s.lat, s.lon);
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const [, list] of byDay) {
      list.forEach((s, i) => {
        const p = px(s.lat, s.lon);
        ctx.fillStyle = colorOf(s);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `900 22px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), p.x, p.y + 1);
      });
    }
  }
  ctx.restore();

  // Map credit (required by OpenStreetMap).
  ctx.font = `500 18px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  const credit = "© OpenStreetMap contributors";
  const cw = ctx.measureText(credit).width + 20;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(W - cw - 8, mapY + mapH - 34, cw, 28);
  ctx.fillStyle = "#334155";
  ctx.fillText(credit, W - cw + 2, mapY + mapH - 14);
  ctx.direction = input.rtl ? "rtl" : "ltr";

  // ── Header ─────────────────────────────────────────────────────────
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, HEAD);
  ctx.fillStyle = SUN;
  ctx.fillRect(0, HEAD - 8, W, 8);
  try {
    const logo = await createImageBitmap(await (await fetch("/sfrtna-mark.png")).blob());
    const s = 92;
    ctx.drawImage(logo, input.rtl ? 40 : W - 40 - s, 52, s, s);
  } catch {
    // No logo then.
  }
  ctx.textAlign = input.rtl ? "right" : "left";
  const tx = input.rtl ? W - 48 : 48;
  ctx.fillStyle = "#fff";
  ctx.fillText(fitText(ctx, input.title, W - 220, 54, 900, 30), tx, 100);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(fitText(ctx, input.subtitle, W - 220, 30, 500, 20), tx, 150);

  // ── Legend + footer ───────────────────────────────────────────────
  const fy = H - FOOT;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, fy, W, FOOT);
  if (multi) {
    // Each city on its own line: its number, name, days and best places.
    input.cities.slice(0, 5).forEach((c, i) => {
      const y = fy + 34 + i * FOOT_LINE;
      const color = COLORS[i % COLORS.length];
      const cxDot = input.rtl ? W - 52 : 52;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cxDot, y, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `900 20px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), cxDot, y + 1);
      const names = [...new Set(input.stops.filter((s) => s.city === i && s.name).map((s) => `${s.icon ?? ""} ${s.name}`.trim()))].slice(0, 4);
      const head = `${c.name} · ${c.label}`;
      ctx.textAlign = input.rtl ? "right" : "left";
      const x0 = input.rtl ? W - 84 : 84;
      ctx.fillStyle = NAVY;
      ctx.font = `800 24px ${FONT}`;
      ctx.fillText(head, x0, y + 1);
      const hw = ctx.measureText(head).width + 24;
      ctx.fillStyle = "#475569";
      const rest = fitText(ctx, names.join(input.rtl ? "، " : ", "), W - 84 - 40 - hw, 21, 500, 16);
      ctx.fillText(rest, input.rtl ? x0 - hw : x0 + hw, y + 1);
    });
  } else {
    const chips: { color: string; text: string }[] = input.stops
      .map((s) => s.day)
      .filter((d, i, all) => all.indexOf(d) === i)
      .sort((a, b) => a - b)
      .map((d) => ({ color: COLORS[d % COLORS.length], text: input.dayLabel(d + 1) }));
    ctx.textBaseline = "middle";
    ctx.font = `700 22px ${FONT}`;
    let x = input.rtl ? W - 40 : 40;
    let y = fy + 36;
    for (const c of chips) {
      const w = ctx.measureText(c.text).width + 44;
      if (input.rtl ? x - w < 40 : x + w > W - 40) {
        x = input.rtl ? W - 40 : 40;
        y += 40;
        if (y > fy + 80) break;
      }
      const x0 = input.rtl ? x - w : x;
      ctx.fillStyle = "#f1f5f9";
      roundRect(ctx, x0, y - 16, w, 32, 16);
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(input.rtl ? x0 + w - 18 : x0 + 18, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = NAVY;
      ctx.textAlign = input.rtl ? "right" : "left";
      ctx.fillText(c.text, input.rtl ? x0 + w - 32 : x0 + 32, y + 1);
      x = input.rtl ? x0 - 10 : x0 + w + 10;
    }
  }
  ctx.fillStyle = NAVY;
  ctx.font = `900 26px ${FONT}`;
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText("sfrtna.com", W / 2, H - 26);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((bl) => (bl ? resolve(bl) : reject(new Error("no blob"))), "image/png"));
}
