"use client";

/**
 * «شارك خريطتي»: a 1080×1350 picture (a phone post) of the traveller's map
 * and numbers, handed to the phone's share sheet (app or browser), else
 * downloaded. Drawn on a canvas from the same shapes as the page.
 */

import type { Locale } from "@/lib/types";
import type { useDictionary } from "@/lib/dict/context";
import { inApp, shareImageInApp } from "@/lib/nativeApp";
import { cityKey, countryKey, statsOf, wishKey, WORLD_TOTAL, type WorldMapFile } from "@/lib/visitedMap";

type T = ReturnType<typeof useDictionary>["visited"];
const FONT = '"Tajawal", "IBM Plex Sans Arabic", system-ui, sans-serif';
const C = { navy: "#04182f", navy2: "#0b2d5b", gold: "#f8b840", ocean: "#eff5fc", none: "#dfe6f0", wish: "#88b1e1" };

export async function drawVisitedImage(input: {
  world: WorldMapFile;
  keys: ReadonlySet<string>;
  cities: { code: string; slug: string; x: number; y: number }[];
  locale: Locale;
  t: T;
  level: string;
}): Promise<Blob> {
  const { world, keys, cities, locale, t, level } = input;
  const W = 1080, H = 1350;
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
  const s = statsOf(keys);

  // Background
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 520);
  glow.addColorStop(0, "rgba(248,184,64,.28)");
  glow.addColorStop(1, "rgba(248,184,64,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const edge = rtl ? W - 72 : 72;
  ctx.textAlign = rtl ? "right" : "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.font = `900 64px ${FONT}`;
  ctx.fillText(t.shareTitle, edge, 150);
  ctx.fillStyle = C.gold;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(level, edge, 205);

  // Numbers
  const pct = `${s.worldPct}${rtl ? "٪" : "%"}`;
  const cols = [
    { big: String(s.countries), small: t.statCountries },
    { big: pct, small: t.statWorld },
    { big: String(s.cities), small: t.statCities },
    { big: String(s.continents), small: t.statContinents },
  ];
  const colW = (W - 144) / cols.length;
  cols.forEach((c, i) => {
    const x = rtl ? W - 72 - colW * i : 72 + colW * i;
    ctx.fillStyle = "#fff";
    ctx.font = `900 76px ${FONT}`;
    ctx.fillText(c.big, x, 345);
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.font = `500 28px ${FONT}`;
    ctx.fillText(c.small, x, 390);
  });
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(t.ofTotal.replace("{total}", String(WORLD_TOTAL)), edge, 432);

  // The map card
  const mx = 40, my = 480, mw = W - 80, mh = 640;
  ctx.save();
  roundRect(ctx, mx, my, mw, mh, 36);
  ctx.fillStyle = C.ocean;
  ctx.fill();
  ctx.clip();
  const scale = Math.min((mw - 40) / world.w, (mh - 40) / world.h);
  const ox = mx + (mw - world.w * scale) / 2, oy = my + (mh - world.h * scale) / 2;
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#e3edf8";
  ctx.fill(new Path2D(world.sphere));
  ctx.lineWidth = 0.6 / scale;
  ctx.strokeStyle = "#fff";
  ctx.lineJoin = "round";
  for (const c of world.countries) {
    const been = keys.has(countryKey(c.c));
    const fill = been ? C.gold : keys.has(wishKey(c.c)) ? C.wish : C.none;
    if (c.d) {
      const p = new Path2D(c.d);
      ctx.fillStyle = fill;
      ctx.fill(p);
      ctx.stroke(p);
    }
    if ((c.b[2] - c.b[0]) * (c.b[3] - c.b[1]) < 9 && fill !== C.none) {
      ctx.beginPath();
      ctx.arc(c.p[0], c.p[1], 3.4, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1.4 / scale;
      ctx.strokeStyle = C.navy2;
      ctx.stroke();
      ctx.lineWidth = 0.6 / scale;
      ctx.strokeStyle = "#fff";
    }
  }
  for (const c of cities) {
    if (!keys.has(cityKey(c.code, c.slug))) continue;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = C.navy2;
    ctx.fill();
    ctx.lineWidth = 1.6 / scale;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  }
  ctx.restore();

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(t.shareFooter, W / 2, 1230);
  ctx.fillStyle = C.gold;
  ctx.font = `900 30px ${FONT}`;
  ctx.fillText(rtl ? "سفرتنا" : "Sfrtna", W / 2, 1285);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png"));
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
