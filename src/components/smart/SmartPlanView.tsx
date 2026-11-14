"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { inApp, printPage, shareImageInApp } from "@/lib/nativeApp";
import { downloadText, safeFileName, toKMLDays } from "@/lib/mapExport";
import { PENDING_PLAN_KEY, refreshAccount, useAccount } from "@/lib/useAccount";
import { findCity } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import ViatorOffers from "@/components/ViatorOffers";
import TripServices from "@/components/TripServices";
import ScrollRow from "@/components/ui/ScrollRow";
import type { PlanAnswers, PlanDay, PlanItem, SmartPlan } from "@/lib/ai/plan";

type T = ReturnType<typeof useDictionary>["smart"];

/** «3 أيام», «مكانان»…: the right Arabic form for the number. */
function counted(forms: { one: string; two: string; few: string; many: string }, n: number): string {
  const f = n === 1 ? forms.one : n === 2 ? forms.two : n <= 10 ? forms.few : forms.many;
  return f.replace("{n}", String(n));
}

function kmBetween(a: { lat?: number; lon?: number }, b: { lat?: number; lon?: number }): number | null {
  if (typeof a.lat !== "number" || typeof b.lat !== "number" || typeof a.lon !== "number" || typeof b.lon !== "number") return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** The day's stops in order, in Google Maps (its links take up to ten points). */
function routeHref(items: PlanItem[]): string | null {
  const pts = items.filter((i) => i.kind !== "move" && typeof i.lat === "number").map((i) => `${i.lat},${i.lon}`);
  if (!pts.length) return null;
  if (pts.length === 1) return `https://www.google.com/maps/search/?api=1&query=${pts[0]}`;
  const list = pts.slice(0, 10);
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", list[0]);
  u.searchParams.set("destination", list[list.length - 1]);
  if (list.length > 2) u.searchParams.set("waypoints", list.slice(1, -1).join("|"));
  return u.toString();
}

/** One stop's facts, each on its own line with its label — only those we have. */
function Facts({ item, t }: { item: PlanItem; t: T }) {
  const rows: [string, string, string][] = [];
  if (item.rating) rows.push(["⭐", t.rating, item.rating]);
  if (item.hours) rows.push(["🕘", t.hours, item.hours]);
  if (item.booking) rows.push(["🎟️", t.booking, item.booking]);
  if (item.dish) rows.push(["🍽️", t.dish, item.dish]);
  if (item.halal) rows.push(["✅", t.halal, item.halal]);
  if (item.dress) rows.push(["👕", t.dress, item.dress]);
  if (item.gettingThere) rows.push(["🧭", t.gettingThere, item.gettingThere]);
  if (item.tip) rows.push(["💡", t.tip, item.tip]);
  if (!rows.length) return null;
  return (
    <dl className="mt-2 space-y-1.5 rounded-2xl bg-mist-50 px-3 py-2.5">
      {rows.map(([icon, label, text]) => (
        <div key={label} className="flex gap-2 text-[13px] leading-relaxed">
          <dt className="shrink-0 font-bold text-navy-500">
            <span aria-hidden="true">{icon}</span> {label}:
          </dt>
          <dd className="min-w-0 text-navy-800">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

const pill = "inline-flex min-h-9 items-center gap-1 rounded-full bg-white px-3.5 text-xs font-bold text-navy-800 ring-1 ring-mist-300 hover:ring-navy-300";
const tool =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-extrabold text-navy-900 ring-1 ring-mist-300 transition hover:ring-navy-300 disabled:opacity-60";

export default function SmartPlanView({
  locale,
  plan,
  answers,
  onNew,
  onRoute,
  initialKeys,
}: {
  locale: Locale;
  plan: SmartPlan;
  /** The answers the plan was built from: kept with a saved plan to rebuild it. */
  answers?: PlanAnswers;
  onNew?: () => void;
  /** Rebuild as a route across cities («multi») or in one city («single»). */
  onRoute?: (route: "multi" | "single") => void;
  /** A saved plan's stops by key: the swaps made before saving come back. */
  initialKeys?: string[][];
}) {
  const dict = useDictionary();
  const t = dict.smart;
  const ct = dict.attractions;
  const isAr = locale === "ar";
  const router = useRouter();
  const account = useAccount();

  // ── The days, with the traveller's swaps ───────────────────────────
  const [days, setDays] = useState<PlanDay[]>(() => {
    const copy: PlanDay[] = plan.days.map((d) => ({
      ...d,
      items: d.items.map((i) => ({ ...i })),
    }));
    if (initialKeys) {
      copy.forEach((d, di) =>
        d.items.forEach((it, ii) => {
          const want = initialKeys[di]?.[ii];
          if (!want || it.key === want || !it.alts) return;
          const k = it.alts.findIndex((a) => a.key === want);
          if (k < 0) return;
          const alt = it.alts[k];
          d.items[ii] = {
            ...alt,
            time: it.time,
            alts: [{ ...it, alts: undefined }, ...it.alts.filter((_, j) => j !== k)],
          };
        }),
      );
    }
    return copy;
  });
  const inPlan = useMemo(() => new Set(days.flatMap((d) => d.items.map((i) => i.key).filter(Boolean) as string[])), [days]);
  const [openSwap, setOpenSwap] = useState<string | null>(null);
  const [justSwapped, setJustSwapped] = useState<string | null>(null);

  function swap(di: number, ii: number, alt: PlanItem) {
    setDays((cur) =>
      cur.map((d, x) => {
        if (x !== di) return d;
        const items = [...d.items];
        const old = items[ii];
        const rest = (old.alts ?? []).filter((a) => a.key !== alt.key);
        items[ii] = {
          ...alt,
          time: old.time,
          alts: [{ ...old, alts: undefined }, ...rest],
        };
        // The next stop's distance now starts from the new one.
        const next = items[ii + 1];
        if (next && next.kind !== "move") {
          const km = kmBetween(items[ii], next);
          if (km !== null && km !== next.fromPrevKm) items[ii + 1] = { ...next, fromPrevKm: km, gettingThere: "" };
        }
        // Times after it move by the difference in visit length, until free
        // time takes it up or the evening meal (fixed) is reached.
        let delta = alt.durationMin - old.durationMin;
        for (let k = ii + 1; k < items.length && delta !== 0; k++) {
          const it = items[k];
          const [h, m] = it.time.split(":").map(Number);
          const at = h * 60 + m;
          // Meals keep their hour when the day gets shorter (no lunch at 11:00), and dinner always.
          if (it.kind === "meal" && (delta < 0 || at >= 18 * 60 + 30)) break;
          if (it.kind === "break" && it.durationMin - delta >= 30 && k > ii + 1) {
            const shifted = at + delta;
            items[k] = {
              ...it,
              time: `${String(Math.floor(shifted / 60)).padStart(2, "0")}:${String(shifted % 60).padStart(2, "0")}`,
              durationMin: it.durationMin - delta,
            };
            delta = 0;
            break;
          }
          const shifted = Math.max(0, at + delta);
          items[k] = {
            ...it,
            time: `${String(Math.floor(shifted / 60) % 24).padStart(2, "0")}:${String(shifted % 60).padStart(2, "0")}`,
          };
        }
        return { ...d, items };
      }),
    );
    const id = `${di}-${ii}`;
    setOpenSwap(null);
    setJustSwapped(id);
    window.setTimeout(() => setJustSwapped((v) => (v === id ? null : v)), 2500);
  }

  // ── Day navigation ─────────────────────────────────────────────────
  const [day, setDay] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    // Not on opening (the row starts at day 1); only when the day changes.
    if (!moved.current) {
      moved.current = true;
      return;
    }
    const el = strip.current?.querySelector<HTMLElement>(`[data-day="${day}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [day]);
  const top = useRef<HTMLDivElement>(null);
  const goDay = (n: number) => {
    setShowAll(false);
    setDay(n);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const fmt = (iso: string, long = false) =>
    /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
          weekday: long ? "long" : "short",
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(new Date(`${iso}T00:00:00Z`))
      : iso;
  const dayDate = (iso: string) =>
    new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
      weekday: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  const dur = (m: number) => (m >= 60 ? t.hoursMin.replace("{h}", String(Math.floor(m / 60))).replace("{m}", String(m % 60)) : t.minutes.replace("{n}", String(m)));
  const placesOf = (d: PlanDay) => d.items.filter((i) => i.kind === "place").length;
  const placesN = days.reduce((n, d) => n + placesOf(d), 0);
  const route = plan.route && plan.route.length > 1 ? plan.route : null;
  const country = findCountry(plan.city.code);
  const title = route ? `${t.routeTitle} ${isAr ? "في" : "in"} ${country ? (isAr ? country.nameAr : country.nameEn) : plan.city.name}` : t.title.replace("{city}", plan.city.name);
  const subtitle = `${fmt(plan.from)} – ${fmt(plan.to)} · ${counted(t.daysWord, days.length)} · ${counted(t.placesWord, placesN)}`;

  // ── Save to the account ────────────────────────────────────────────
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "full">("idle");
  const canSave = Boolean(answers) && account.status === "ready" && (account.user || account.methods.email || account.methods.google);
  const saveBody = () =>
    JSON.stringify({
      title,
      plan: {
        code: plan.city.code,
        slug: plan.city.slug,
        city: plan.city.name,
        locale,
        source: "smart",
        from: plan.from,
        to: plan.to,
        days: days.map((d) => d.items.slice(0, 40).map((i) => i.key ?? "")),
        smart: { answers },
      },
    });
  async function save() {
    const back = `/${locale}/attractions/${plan.city.code}/${plan.city.slug}?from=${plan.from}&to=${plan.to}#trip-plan`;
    if (account.status === "ready" && !account.user) {
      try {
        sessionStorage.setItem(PENDING_PLAN_KEY, saveBody());
      } catch {
        // Private mode: they save again after signing in.
      }
      router.push(`/${locale}/account?next=${encodeURIComponent(back)}`);
      return;
    }
    setSaveState("saving");
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: saveBody(),
        });
        if (res.status === 401) {
          await refreshAccount();
          setSaveState("idle");
          return;
        }
        const j = (await res.json().catch(() => ({ ok: false }))) as {
          ok: boolean;
          reason?: string;
        };
        if (j.ok) return setSaveState("saved");
        if (j.reason === "too_many") return setSaveState("full");
        if (res.status < 500) break;
      } catch {
        // One quiet retry.
      }
    }
    setSaveState("error");
  }

  // ── Google Maps, image, PDF ────────────────────────────────────────
  const [mapsOpen, setMapsOpen] = useState(false);
  const fileBase = `sfrtna-plan-${plan.city.code}-${plan.city.name}`;
  function downloadKml() {
    const list = days.map((d, i) => ({
      name: `${t.day.replace("{n}", String(i + 1))} · ${fmt(d.date)}${d.city ? ` · ${d.city.name}` : ""}`,
      places: d.items
        .filter((it) => it.kind !== "move" && it.kind !== "break" && typeof it.lat === "number")
        .map((it) => ({
          name: it.name,
          lat: it.lat as number,
          lon: it.lon as number,
          description: [it.time, it.why].filter(Boolean).join(" — "),
        })),
    }));
    downloadText(toKMLDays(list, title), safeFileName(fileBase, "kml"), "application/vnd.google-earth.kml+xml");
  }

  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null);
  const [imageSaveFailed, setImageSaveFailed] = useState(false);
  /** Save or share the picture: the app's share sheet, else the phone browser's, else a download. */
  async function saveImage() {
    if (!image) return;
    setImageSaveFailed(false);
    const name = safeFileName(fileBase.replace(/[^\w-]+/g, "-"), "png");
    if (await shareImageInApp(name, image.blob)) return;
    try {
      const file = new File([image.blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    if (inApp()) {
      setImageSaveFailed(true);
      return;
    }
    const a = document.createElement("a");
    a.href = image.url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState(false);
  async function makeImage() {
    setImageBusy(true);
    setImageError(false);
    try {
      const { drawPlanImage } = await import("@/lib/planImage");
      const cityIdx = new Map((route ?? []).map((l, i) => [l.slug, i]));
      const stops = days.flatMap((d, di) =>
        d.items
          .filter((it) => it.kind === "place" && typeof it.lat === "number")
          .map((it) => ({
            lat: it.lat as number,
            lon: it.lon as number,
            icon: it.icon,
            name: it.name,
            day: di,
            city: d.city ? (cityIdx.get(d.city.slug) ?? 0) : 0,
          })),
      );
      const blob = await drawPlanImage({
        title,
        subtitle,
        stops,
        cities: (route ?? []).map((l) => ({
          name: l.name,
          lat: l.lat,
          lon: l.lon,
          label: l.dayTrip ? `${t.dayTrip} · ${counted(t.daysWord, l.days)}` : counted(t.daysWord, l.days),
          dayTrip: l.dayTrip,
        })),
        dayLabel: (n) => t.day.replace("{n}", String(n)),
        rtl: isAr,
      });
      setImage({ url: URL.createObjectURL(blob), blob });
    } catch {
      setImageError(true);
    } finally {
      setImageBusy(false);
    }
  }
  useEffect(() => () => void (image && URL.revokeObjectURL(image.url)), [image]);

  const sheet = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  async function savePdf() {
    if (inApp() || !sheet.current) return printPage(title);
    setPdfBusy(true);
    const before = showAll;
    setShowAll(true);
    try {
      // Every day on the page, then each block as a picture on A4 (planPdf.ts).
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const { downloadPlanPdf } = await import("@/lib/planPdf");
      const blocks = [...sheet.current.querySelectorAll<HTMLElement>("[data-pdf]")];
      await downloadPlanPdf(blocks, safeFileName(fileBase, "pdf"));
    } catch {
      printPage(title);
    } finally {
      setShowAll(before);
      setPdfBusy(false);
    }
  }

  // ── Before you travel ──────────────────────────────────────────────
  const ess = plan.essentials;
  const essBlocks = (
    [
      ["🎒", t.packing, ess.packing],
      ["🤝", t.etiquette, ess.etiquette],
      ["🚇", t.transport, ess.transport],
      ["💳", t.money, ess.money],
      ["🗣️", t.phrases, ess.phrases],
      ["🛡️", t.safety, ess.safety],
    ] as [string, string, string[]][]
  ).filter(([, , list]) => list.length > 0);
  const mainCity = findCity(plan.city.code, plan.city.slug);

  // ── One stop ───────────────────────────────────────────────────────
  const itemRow = (it: PlanItem, di: number, ii: number, placeNo: number) => {
    const id = `${di}-${ii}`;
    const alts = (it.alts ?? []).filter((a) => !a.key || !inPlan.has(a.key));
    if (it.kind === "move") {
      const dir =
        it.from && typeof it.lat === "number"
          ? `https://www.google.com/maps/dir/?api=1&origin=${it.from.lat},${it.from.lon}&destination=${it.lat},${it.lon}&travelmode=driving`
          : null;
      return (
        <li key={id} className="relative">
          <span className="absolute -start-[1.95rem] top-2 flex h-7 w-7 items-center justify-center rounded-full bg-sea-600 text-sm ring-4 ring-white" aria-hidden="true">
            🚗
          </span>
          <div className="rounded-2xl bg-sea-50 px-4 py-3 ring-1 ring-sea-100">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-sm font-black text-sea-800" dir="ltr">
                {it.time}
              </span>
              <span className="font-display text-base font-extrabold text-navy-950">{it.name}</span>
              <span className="text-xs font-semibold text-navy-500">· {dur(it.durationMin)}</span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-navy-700">{it.why}</p>
            {dir && (
              <a href={dir} target="_blank" rel="noopener noreferrer" className={`${pill} mt-2 print:hidden`}>
                🗺️ {t.routeOnMap}
              </a>
            )}
          </div>
        </li>
      );
    }
    const isPlace = it.kind === "place";
    return (
      <li key={id} className={`relative transition ${justSwapped === id ? "rounded-2xl bg-emerald-50/70 px-2 py-2 ring-2 ring-emerald-300" : ""}`}>
        <span
          className={`absolute -start-[1.95rem] top-1 flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black ring-4 ring-white ${
            it.kind === "meal" ? "bg-amber-400" : it.kind === "break" ? "bg-mist-300" : "bg-navy-900 text-white"
          }`}
          aria-hidden="true"
        >
          {it.kind === "meal" ? "🍴" : it.kind === "break" ? "☕" : placeNo}
        </span>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {it.time && (
            <span className="font-display text-sm font-black text-sea-700" dir="ltr">
              {it.time}
            </span>
          )}
          <span className="font-display text-base font-extrabold text-navy-950 sm:text-lg">{it.name}</span>
          {it.durationMin > 0 && <span className="rounded-full bg-mist-100 px-2 py-0.5 text-[11px] font-bold text-navy-600">⏱ {dur(it.durationMin)}</span>}
          {it.kind !== "place" && <span className="text-xs font-semibold text-navy-500">· {it.kind === "meal" ? t.meal : t.rest}</span>}
        </div>
        {(it.localName && it.localName !== it.name) || it.area ? (
          <p className="mt-0.5 text-xs text-navy-500" dir="auto">
            {[it.localName !== it.name ? it.localName : "", it.area].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {typeof it.fromPrevKm === "number" && it.fromPrevKm > 0 && <p className="mt-0.5 text-[11px] font-semibold text-navy-400">↳ {t.km.replace("{n}", String(it.fromPrevKm))}</p>}
        {justSwapped === id && <p className="mt-1 text-xs font-extrabold text-emerald-700">{t.swapped}</p>}
        {it.forYou && (
          <p className="mt-1 inline-flex rounded-full bg-sun-50 px-2.5 py-0.5 text-[11px] font-extrabold text-sun-800 ring-1 ring-sun-200">
            {it.forYou === "famous" ? `⭐ ${t.famousPick}` : t.forYou.replace("{x}", (t.interests as Record<string, string>)[it.forYou] ?? "")}
          </p>
        )}
        {it.why && <p className="mt-1 text-[13px] leading-relaxed text-navy-700">{it.why}</p>}
        <Facts item={it} t={t} />
        <div className="mt-2 flex flex-wrap gap-2 print:hidden">
          {alts.length > 0 && (
            <button
              type="button"
              aria-expanded={openSwap === id}
              onClick={() => setOpenSwap(openSwap === id ? null : id)}
              className={`${pill} ${openSwap === id ? "!bg-navy-900 !text-white !ring-navy-900" : ""}`}
            >
              🔁 {t.swap}
            </button>
          )}
          {it.mapQuery && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.mapQuery)}`} target="_blank" rel="noopener noreferrer" className={pill}>
              📍 {t.onMap}
            </a>
          )}
          {it.website && (
            <a href={it.website} target="_blank" rel="noopener noreferrer" className={pill}>
              🌐 {t.website}
            </a>
          )}
          {isPlace && it.ticketQuery && (
            <button
              type="button"
              aria-expanded={openSwap === `t-${id}`}
              onClick={() => setOpenSwap(openSwap === `t-${id}` ? null : `t-${id}`)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-sun-400 px-3.5 text-xs font-extrabold text-navy-950"
            >
              🎟️ {ct.ticketOffers} {openSwap === `t-${id}` ? "▴" : "▾"}
            </button>
          )}
        </div>
        {openSwap === `t-${id}` && it.ticketQuery && (
          <div className="mt-2 print:hidden">
            <ViatorOffers locale={locale} city={days[di].city?.slug ?? plan.city.slug} q={it.ticketQuery} n={3} compact />
          </div>
        )}
        {openSwap === id && alts.length > 0 && (
          <div className="mt-3 rounded-2xl bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-navy-950/10 print:hidden">
            <p className="text-sm font-extrabold text-navy-900">🔁 {t.swapTitle}</p>
            <ul className="mt-2 space-y-2">
              {alts.map((a) => (
                <li key={a.key ?? a.name} className="rounded-xl bg-mist-50 p-3 ring-1 ring-mist-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-extrabold text-navy-950">{a.name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] font-semibold text-navy-500">
                        {a.durationMin > 0 && <span>⏱ {dur(a.durationMin)}</span>}
                        {typeof a.fromPrevKm === "number" && a.fromPrevKm > 0 && <span>↳ {t.km.replace("{n}", String(a.fromPrevKm))}</span>}
                        {a.dish && <span>🍽️ {a.dish}</span>}
                        {a.halal && <span>✅ {a.halal}</span>}
                      </p>
                      {a.forYou && (
                        <p className="mt-1 inline-flex rounded-full bg-sun-50 px-2 py-0.5 text-[10px] font-extrabold text-sun-800 ring-1 ring-sun-200">
                          {a.forYou === "famous" ? `⭐ ${t.famousPick}` : t.forYou.replace("{x}", (t.interests as Record<string, string>)[a.forYou] ?? "")}
                        </p>
                      )}
                      {a.why && a.kind === "place" && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-navy-700">{a.why}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => swap(di, ii, a)}
                      className="min-h-9 shrink-0 rounded-full bg-sun-400 px-3.5 text-xs font-extrabold text-navy-950 hover:bg-sun-300"
                    >
                      {t.swapPick}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </li>
    );
  };

  // ── One day ────────────────────────────────────────────────────────
  const dayView = (dd: PlanDay, i: number, withNav: boolean) => {
    const href = routeHref(dd.items);
    let placeNo = 0;
    return (
      <section key={dd.date} data-pdf className="overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)] ring-1 ring-navy-950/5">
        <header className="flex items-center gap-3 bg-gradient-to-l from-navy-950 to-navy-800 px-4 py-3.5 text-white sm:px-6">
          <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-sun-400 font-display text-navy-950">
            <span className="text-[10px] font-extrabold leading-none">{isAr ? "اليوم" : "Day"}</span>
            <span className="text-xl font-black leading-none">{i + 1}</span>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-sun-300">
              {fmt(dd.date, true)}
              {dd.city ? ` · ${dd.city.name}` : ""} · {t.dayStops.replace("{n}", counted(t.placesWord, placesOf(dd)))}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-extrabold leading-snug sm:text-xl">{dd.title}</h3>
          </div>
        </header>
        <div className="p-4 sm:p-6">
          <div className="grid gap-2 sm:grid-cols-2">
            {dd.weather && (
              <p className="rounded-2xl bg-sky-50 px-3 py-2 text-[13px] leading-relaxed text-sky-950 ring-1 ring-sky-100">
                <span className="font-extrabold">🌤 {t.weather}:</span> {dd.weather}
              </p>
            )}
            {dd.wear && (
              <p className="rounded-2xl bg-violet-50 px-3 py-2 text-[13px] leading-relaxed text-violet-950 ring-1 ring-violet-100">
                <span className="font-extrabold">👕 {t.wear}:</span> {dd.wear}
              </p>
            )}
          </div>
          {dd.prayers && (
            // Five equal boxes, name over time: always inside the frame (owner, 14 Nov).
            <div className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-950 ring-1 ring-emerald-100">
              <p className="text-[13px] font-extrabold">🕌 {t.prayersTitle}</p>
              <ul className="mt-1.5 grid grid-cols-5 gap-1 text-center">
                {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map((k) => (
                  <li key={k} className="min-w-0 rounded-xl bg-white/70 px-0.5 py-1">
                    <span className="block truncate text-[11px] font-bold text-emerald-800">{t.prayers[k]}</span>
                    <span className="block text-[13px] font-extrabold tabular-nums" dir="ltr">
                      {dd.prayers?.[k]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dd.notes && dd.notes.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-2xl bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-950 ring-1 ring-amber-100">
              {dd.notes.map((n) => (
                <li key={n}>ℹ️ {n}</li>
              ))}
            </ul>
          )}

          <ol className="relative ms-3 mt-5 space-y-5 border-s-2 border-dashed border-mist-300 ps-6">
            {dd.items.map((it, ii) => {
              if (it.kind === "place") placeNo++;
              return itemRow(it, i, ii, placeNo);
            })}
          </ol>

          <div className="mt-6 flex flex-wrap items-center gap-2 print:hidden">
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-full bg-navy-900 px-4 text-sm font-extrabold text-white hover:bg-navy-800"
              >
                🗺️ {t.openMap}
              </a>
            )}
            {withNav && (
              <span className="ms-auto flex gap-2">
                {i > 0 && (
                  <button type="button" onClick={() => goDay(i - 1)} className={tool}>
                    {isAr ? "→" : "←"} {t.prevDay}
                  </button>
                )}
                {i < days.length - 1 && (
                  <button type="button" onClick={() => goDay(i + 1)} className={`${tool} !bg-sun-400 !ring-sun-400`}>
                    {t.nextDay} {isAr ? "←" : "→"}
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
      </section>
    );
  };

  const saveLabel =
    saveState === "saving"
      ? t.saving
      : saveState === "saved"
        ? t.saved
        : saveState === "error"
          ? t.saveFailed
          : saveState === "full"
            ? t.saveFull
            : account.user
              ? t.save
              : t.saveSignIn;

  return (
    <div ref={sheet} className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      {/* Title, the route and what the plan took into account. */}
      <section data-pdf className="overflow-hidden rounded-3xl bg-navy-950 text-white shadow-[var(--shadow-card)]">
        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-xs font-bold text-sun-300">{subtitle}</p>
          <h2 className="mt-1 font-display text-xl font-black leading-snug sm:text-2xl">{title}</h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs font-extrabold">
            <li className="rounded-full bg-white/10 px-3 py-1">📅 {counted(t.daysWord, days.length)}</li>
            <li className="rounded-full bg-white/10 px-3 py-1">📍 {counted(t.placesWord, placesN)}</li>
            {route && <li className="rounded-full bg-white/10 px-3 py-1">🏙️ {route.length}</li>}
          </ul>
          {route && (
            <ol className="mt-4 flex flex-wrap items-center gap-1.5">
              {route.map((l, i) => (
                <li key={l.slug} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="text-sun-300" aria-hidden="true">
                      {isAr ? "←" : "→"}
                    </span>
                  )}
                  <span className="rounded-2xl bg-white px-3 py-1.5 text-navy-950">
                    <span className="font-display text-sm font-extrabold">{l.name}</span>
                    <span className="ms-2.5 text-[11px] font-bold text-navy-500">
                      {counted(t.daysWord, l.days)}
                      {l.dayTrip ? ` · ${t.dayTrip}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {plan.summary && <p className="mt-4 text-sm leading-relaxed text-white/85">{plan.summary}</p>}
          {!route && plan.cityDays && !plan.suggest && (
            <p className="mt-3 text-xs font-bold text-sun-200">💡 {t.cityNeeds.replace("{city}", plan.city.name).replace("{n}", counted(t.daysWord, plan.cityDays))}</p>
          )}
          {route && onRoute && (
            <button type="button" onClick={() => onRoute("single")} className="mt-3 text-xs font-bold text-white/70 underline underline-offset-4 hover:text-white print:hidden">
              {t.singleBtn.replace("{city}", plan.city.name)}
            </button>
          )}
        </div>
      </section>

      {/* A trip longer than the city needs: the cities it could go on to. */}
      {plan.suggest && plan.suggest.length > 0 && (
        <section className="mt-4 rounded-3xl bg-sun-50 px-5 py-4 ring-1 ring-sun-200 print:hidden">
          <p className="font-display text-base font-extrabold text-navy-950">🧭 {t.suggestTitle.replace("{city}", plan.city.name)}</p>
          <p className="mt-1 text-sm leading-relaxed text-navy-800">
            {t.suggestText
              .replace("{city}", plan.city.name)
              .replace("{n}", counted(t.daysWord, plan.cityDays ?? 1))
              .replace("{list}", plan.suggest.map((l) => `${l.name} (${counted(t.daysWord, l.days)})`).join(isAr ? "، " : ", "))}
          </p>
          {onRoute && (
            <button type="button" onClick={() => onRoute("multi")} className="mt-3 min-h-11 rounded-full bg-sun-400 px-5 text-sm font-extrabold text-navy-950 hover:bg-sun-300">
              {t.suggestBtn}
            </button>
          )}
        </section>
      )}

      {/* What the traveller can do with the plan. */}
      <ScrollRow outerClassName="-mx-4 mt-4 print:hidden" className="flex gap-2 px-4 pb-1">
        {canSave && (
          <button
            type="button"
            onClick={save}
            disabled={saveState === "saving" || saveState === "saved"}
            className={`${tool} ${saveState === "saved" ? "!bg-emerald-600 !text-white !ring-emerald-600" : "!bg-sun-400 !ring-sun-400"}`}
          >
            {saveState === "saved" ? "✓" : "💾"} {saveLabel}
          </button>
        )}
        <button type="button" onClick={() => setMapsOpen(true)} className={tool}>
          🗺️ {t.maps}
        </button>
        <button type="button" onClick={makeImage} disabled={imageBusy} className={tool}>
          🖼️ {imageBusy ? t.imageBusy : t.image}
        </button>
        <button type="button" onClick={savePdf} disabled={pdfBusy} className={tool}>
          📄 {pdfBusy ? t.pdfBusy : t.print}
        </button>
        {onNew && (
          <button type="button" onClick={onNew} className={`${tool} !font-bold !text-navy-700`}>
            ✨ {t.newPlan}
          </button>
        )}
      </ScrollRow>
      {imageError && (
        <p role="alert" className="mt-2 text-sm font-bold text-rose-700">
          {t.imageFailed}
        </p>
      )}

      {/* Days: a strip to move between them, or every day one after another. */}
      <div ref={top} className="sticky top-0 z-10 -mx-4 mt-4 bg-mist-50/95 px-4 py-2 backdrop-blur print:hidden">
        <div ref={strip}>
          <ScrollRow className="flex snap-x gap-2 pb-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={showAll}
              onClick={() => setShowAll(true)}
              className={`flex shrink-0 snap-start flex-col items-center justify-center rounded-2xl px-3.5 py-1.5 text-xs font-extrabold ring-1 ${
                showAll ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-800 ring-mist-300"
              }`}
            >
              <span className="text-base" aria-hidden="true">
                ☰
              </span>
              {t.allDays}
            </button>
            {days.map((dd, i) => {
              const sel = !showAll && i === day;
              return (
                <button
                  key={dd.date}
                  type="button"
                  role="tab"
                  data-day={i}
                  aria-selected={sel}
                  onClick={() => {
                    setShowAll(false);
                    setDay(i);
                  }}
                  className={`flex w-[5.5rem] shrink-0 snap-start flex-col items-start justify-center rounded-2xl px-3 py-1.5 text-start ring-1 transition ${
                    sel ? "bg-sun-400 text-navy-950 ring-sun-400 shadow-[var(--shadow-sun)]" : "bg-white text-navy-800 ring-mist-300 hover:ring-navy-300"
                  }`}
                >
                  <span className="font-display text-sm font-black">{t.day.replace("{n}", String(i + 1))}</span>
                  <span className="text-[11px] font-bold opacity-80">{dayDate(dd.date)}</span>
                  <span className="w-full truncate text-[10px] font-semibold opacity-70">{dd.city ? dd.city.name : counted(t.placesWord, placesOf(dd))}</span>
                </button>
              );
            })}
          </ScrollRow>
        </div>
      </div>

      <div className="mt-3 space-y-6 print:hidden">{showAll ? days.map((dd, i) => dayView(dd, i, false)) : days[day] && dayView(days[day], day, true)}</div>
      <div className="hidden space-y-6 print:block">{days.map((dd, i) => dayView(dd, i, false))}</div>

      {/* «قبل أن تسافر»: every service for the trip, then what to bring. */}
      <section id="before-you-travel" className="mt-8 rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-6 print:hidden">
        <h3 className="font-display text-xl font-black text-navy-950">🧳 {t.before}</h3>
        <p className="mt-1 text-xs leading-relaxed text-navy-500 sm:text-sm">{t.beforeSub}</p>
        {mainCity && (
          <TripServices
            locale={locale}
            countryCode={plan.city.code}
            citySlug={plan.city.slug}
            cityName={plan.city.name}
            cityNameEn={mainCity.nameEn}
            dates={{ from: plan.from, to: plan.to }}
            bare
            t={ct}
          />
        )}
        {route &&
          route.slice(1).map((l) => {
            const c = findCity(l.code, l.slug);
            if (!c) return null;
            return (
              <div key={l.slug} className="mt-5">
                <p className="text-sm font-extrabold text-navy-900">📍 {l.name}</p>
                <TripServices locale={locale} countryCode={l.code} citySlug={l.slug} cityName={l.name} cityNameEn={c.nameEn} only={["activity"]} bare t={ct} />
              </div>
            );
          })}
      </section>

      {(essBlocks.length > 0 || ess.emergency) && (
        <section data-pdf className="mt-6 rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-6">
          <h3 className="font-display text-lg font-extrabold text-navy-950">🎒 {t.tipsTitle}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {essBlocks.map(([icon, head, list]) => (
              <div key={head}>
                <p className="text-sm font-extrabold text-navy-900">
                  <span aria-hidden="true">{icon}</span> {head}
                </p>
                <ul className="mt-1.5 list-disc space-y-1 ps-5 text-[13px] leading-relaxed text-navy-700">
                  {list.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {ess.emergency && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800 ring-1 ring-red-100">
              🚨 {t.emergency}: {ess.emergency}
            </p>
          )}
        </section>
      )}

      {plan.sources.length > 0 && (
        <section className="mt-6 rounded-3xl bg-white p-4 ring-1 ring-navy-950/5 sm:p-6">
          <h3 className="text-sm font-extrabold text-navy-900">🔗 {t.sources}</h3>
          <ul className="mt-2 space-y-1">
            {plan.sources.map((s) => (
              <li key={s.url} className="truncate text-xs">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sea-700 hover:underline" dir="auto">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-navy-500">{t.sourcesNote}</p>
        </section>
      )}

      {/* Google Maps: each day's route, or every place in a map of their own. */}
      {mapsOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-navy-950/50 sm:items-center print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t.mapsTitle}
          onClick={() => setMapsOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-black text-navy-950">🗺️ {t.mapsTitle}</h3>
              <button
                type="button"
                onClick={() => setMapsOpen(false)}
                aria-label={t.close}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist-100 font-bold"
              >
                ✕
              </button>
            </div>
            <p className="mt-3 text-sm font-extrabold text-navy-900">{t.mapsDays}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {days.map((dd, i) => {
                const href = routeHref(dd.items);
                if (!href) return null;
                return (
                  <a
                    key={dd.date}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-mist-50 px-3 py-2.5 text-start ring-1 ring-mist-200 hover:ring-navy-300"
                  >
                    <span className="block font-display text-sm font-extrabold text-navy-950">📍 {t.mapsDay.replace("{n}", String(i + 1))}</span>
                    <span className="block truncate text-[11px] font-semibold text-navy-500">{dd.city?.name ?? fmt(dd.date)}</span>
                  </a>
                );
              })}
            </div>
            <p className="mt-5 text-sm font-extrabold text-navy-900">{t.mapsAll}</p>
            <button type="button" onClick={downloadKml} className="mt-2 min-h-12 w-full rounded-full bg-sun-400 px-5 font-extrabold text-navy-950 hover:bg-sun-300">
              ⬇️ {t.mapsKml}
            </button>
            <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-[13px] leading-relaxed text-navy-700">
              {t.mapsHow.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* The route image, ready to save or share. */}
      {image && (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-navy-950/85 p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t.image}
          onClick={() => setImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a picture drawn here, as a blob */}
          <img src={image.url} alt={title} className="max-h-[75vh] w-auto rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          {imageSaveFailed && <p className="max-w-sm text-center text-xs font-bold text-sun-200">{t.imageUpdateApp}</p>}
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={saveImage} className="inline-flex min-h-11 items-center rounded-full bg-sun-400 px-5 font-extrabold text-navy-950">
              ⬇️ {t.imageSave}
            </button>
            <button type="button" onClick={() => setImage(null)} className="min-h-11 rounded-full bg-white/15 px-5 font-bold text-white">
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
