"use client";

/**
 * «شارك»: a 1080×1920 story picture of the traveller's map, numbers and
 * badges, handed to the phone's share sheet (app or browser), else
 * downloaded. Drawn on a canvas from the same shapes as the page.
 */

import type { Locale } from "@/lib/types";
import type { useDictionary } from "@/lib/dict/context";
import { inApp, shareImageInApp } from "@/lib/nativeApp";
import { WORLD_TOTAL, type Visited, type VisitedStats, type WorldMapFile } from "@/lib/visitedMap";
import { NIGHT, type CityPoint } from "./WorldCanvas";
import type { Badge } from "./badges";

type T = ReturnType<typeof useDictionary>["visited"];
const FONT = '"Tajawal", "IBM Plex Sans Arabic", system-ui, sans-serif';

export async function drawVisitedImage(input: {
  world: WorldMapFile;
  visited: Visited;
  stats: VisitedStats;
  cities: CityPoint[];
  badges: Badge[];
  locale: Locale;
  t: T;
  level: string;
}): Promise<Blob> {
  const { world, visited, stats: s, cities, badges, locale, t, level } = input;
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  try {
    await document.fonts?.ready;
  } catch {
    /* draw with what is there */
  }
  const rtl = locale === "ar";
  ctx.direction = rtl ? "rtl" : "ltr";

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#04182f");
  bg.addColorStop(1, "#071f3d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.8, 160, 10, W * 0.8, 160, 620);
  glow.addColorStop(0, "rgba(248,184,64,.25)");
  glow.addColorStop(1, "rgba(248,184,64,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const edge = rtl ? W - 80 : 80;
  ctx.textAlign = rtl ? "right" : "left";
  ctx.fillStyle = "#fff";
  ctx.font = `900 76px ${FONT}`;
  ctx.fillText(t.shareTitle, edge, 220);
  ctx.fillStyle = NIGHT.been;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(level, edge, 285);

  // Map
  const my = 360, mh = 640;
  const scale = (W - 40) / world.w;
  const ox = 20, oy = my + (mh - world.h * 0.86 * scale) / 2 - world.h * 0.06 * scale;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.lineWidth = 0.7 / scale;
  ctx.strokeStyle = NIGHT.line;
  ctx.lineJoin = "round";
  for (const c of world.countries) {
    const fill = visited.countries.has(c.c) ? NIGHT.been : visited.dreams.has(c.c) ? NIGHT.wish : NIGHT.land;
    if (c.d) {
      const p = new Path2D(c.d);
      ctx.fillStyle = fill;
      ctx.fill(p);
      ctx.stroke(p);
    }
    if ((c.b[2] - c.b[0]) * (c.b[3] - c.b[1]) < 9 && fill !== NIGHT.land) {
      ctx.beginPath();
      ctx.arc(c.p[0], c.p[1], 3.2, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }
  for (const c of cities) {
    if (!c.been) continue;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 1.4 / scale;
    ctx.strokeStyle = "#061a33";
    ctx.stroke();
  }
  ctx.restore();

  // Numbers
  const pct = `${s.worldPct}${rtl ? "٪" : "%"}`;
  ctx.textAlign = "center";
  ctx.fillStyle = NIGHT.been;
  ctx.font = `900 150px ${FONT}`;
  ctx.fillText(pct, W / 2, 1170);
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText(t.statWorld, W / 2, 1225);
  const cols = [
    { big: String(s.countries), small: t.statCountries },
    { big: String(s.cities), small: t.statCities },
    { big: String(s.continents), small: t.statContinents },
    { big: String(badges.filter((b) => b.now >= b.need).length), small: t.statBadges },
  ];
  const colW = (W - 120) / cols.length;
  cols.forEach((c, i) => {
    const x = rtl ? W - 60 - colW * (i + 0.5) : 60 + colW * (i + 0.5);
    ctx.fillStyle = "#fff";
    ctx.font = `900 80px ${FONT}`;
    ctx.fillText(c.big, x, 1380);
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(c.small, x, 1428);
  });
  ctx.fillStyle = "rgba(255,255,255,.4)";
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(t.ofTotal.replace("{total}", String(WORLD_TOTAL)), W / 2, 1480);

  // Badges earned
  const won = badges.filter((b) => b.now >= b.need).slice(0, 7);
  if (won.length) {
    const size = 104, gap = 22;
    const total = won.length * size + (won.length - 1) * gap;
    won.forEach((b, i) => {
      const x = (W - total) / 2 + i * (size + gap) + size / 2;
      ctx.beginPath();
      ctx.arc(x, 1600, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(248,184,64,.16)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = NIGHT.been;
      ctx.stroke();
      ctx.font = `56px ${FONT}`;
      ctx.fillStyle = "#fff";
      ctx.fillText(b.icon, x, 1620);
    });
  }

  ctx.fillStyle = "#fff";
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(t.shareFooter, W / 2, 1780);
  ctx.fillStyle = NIGHT.been;
  ctx.font = `900 36px ${FONT}`;
  ctx.fillText(rtl ? "سفرتنا" : "Sfrtna", W / 2, 1840);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png"));
}

/** Draw, then the share sheet (app, then browser), else a download. */
export async function shareVisitedImage(input: Parameters<typeof drawVisitedImage>[0]): Promise<void> {
  const blob = await drawVisitedImage(input);
  const name = "sfrtna-my-map.png";
  if (await shareImageInApp(name, blob)) return;
  try {
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: input.t.shareTitle });
      return;
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
  }
  if (inApp()) throw new Error("app cannot share files");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
