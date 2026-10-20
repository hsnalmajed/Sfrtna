// «طيران + فندق» (owner, 20 Oct): one search, two budgets. The flight half
// is the ordinary flight search; the hotel half rides along in the same
// address under its own names (h…), so the flight results page can show the
// hotel too, each held to its own budget and preferences.

import { NO_HOTEL_PREFS, readHotelPrefs, writeHotelPrefs, type HotelPrefs } from "@/lib/hotelPrefs";

export interface ComboHotel {
  /** A named hotel (its own name, picked from the list), or "" for "suggest hotels in my destination". */
  name: string;
  area: string;
  /** How the name and area read on this page (Arabic names on the Arabic page). */
  label: string;
  areaLabel: string;
  /** The name was picked from the list (a typed name finds the wrong hotel). */
  picked: boolean;
  /** The hotel budget for the whole stay, digits. */
  budget: string;
  minStars: number;
  breakfast: boolean;
  prefs: HotelPrefs;
}

export const EMPTY_COMBO: ComboHotel = {
  name: "",
  area: "",
  label: "",
  areaLabel: "",
  picked: false,
  budget: "",
  minStars: 0,
  breakfast: false,
  prefs: NO_HOTEL_PREFS,
};

/** The hotel half of a combo search, from an address. */
export function readCombo(sp: URLSearchParams): ComboHotel {
  const name = sp.get("hn") || "";
  const prefSource = new URLSearchParams();
  for (const k of ["place", "amen", "rating", "fc"]) {
    const v = sp.get(`h${k}`);
    if (v) prefSource.set(k, v);
  }
  return {
    name,
    area: sp.get("ha") || "",
    label: sp.get("hl") || "",
    areaLabel: sp.get("hal") || "",
    picked: Boolean(name && sp.get("ha")),
    budget: sp.get("hb") || "",
    minStars: Number(sp.get("hs")) || 0,
    breakfast: sp.get("hbf") === "1",
    prefs: readHotelPrefs(prefSource),
  };
}

export function writeCombo(c: ComboHotel, out: URLSearchParams) {
  out.set("combo", "1");
  if (c.name && c.picked) {
    out.set("hn", c.name);
    if (c.area) out.set("ha", c.area);
    if (c.label && c.label !== c.name) out.set("hl", c.label);
    if (c.areaLabel && c.areaLabel !== c.area) out.set("hal", c.areaLabel);
  }
  if (Number(c.budget) > 0) out.set("hb", String(Number(c.budget)));
  if (c.minStars) out.set("hs", String(c.minStars));
  if (c.breakfast) out.set("hbf", "1");
  const p = new URLSearchParams();
  writeHotelPrefs(c.prefs, p);
  for (const [k, v] of p) out.set(`h${k}`, v);
}

/** Only the combo's own keys of an address, to carry them on to the next page. */
export function comboParams(sp: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of sp) if (k === "combo" || /^h(n|a|l|al|b|s|bf|place|amen|rating|fc)$/.test(k)) out.set(k, v);
  return out;
}

/** The hotel-results address for a combo's hotel half in a city. */
export function comboHotelHref(locale: string, c: ComboHotel, city: { nameEn: string; label: string }, checkIn: string, checkOut: string, party: Record<string, string>) {
  const p = new URLSearchParams({ checkIn, checkOut, ...party });
  if (c.name && c.picked) {
    p.set("hmode", "known");
    p.set("hotel", c.name);
    if (c.area) p.set("hotelArea", c.area);
    if (c.label) p.set("label", c.label);
    if (c.areaLabel) p.set("areaLabel", c.areaLabel);
  } else {
    p.set("hmode", "discover");
    p.set("city", city.nameEn);
    p.set("label", city.label);
    if (Number(c.budget) > 0) p.set("budget", String(Number(c.budget)));
    if (c.minStars) p.set("minStars", String(c.minStars));
    if (c.breakfast) p.set("breakfast", "true");
    writeHotelPrefs(c.prefs, p);
  }
  return `/${locale}/hotel-results?${p.toString()}`;
}
