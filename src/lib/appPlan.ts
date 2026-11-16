/**
 * The iPhone app's own «خطّط» screen (mobile/ios, `PlanCreateController`,
 * 16 Nov 2026): it asks the questions natively, calls /api/ai/plan with
 * `app: true`, and gets back — next to the plan — the same offline copy the
 * site hands to «احفظ على جوالي» (src/lib/tripMode.ts), so a plan made on
 * the native screen is kept exactly like one made on the site.
 *
 * Titles and words follow SmartPlanView (same dictionary keys, same id).
 */

import type { SmartPlan } from "@/lib/ai/plan";
import { findCountry } from "@/lib/countries";
import { getDictionary } from "@/lib/dictionaries";
import { offlinePlanId } from "@/lib/nativeApp";
import { buildOfflinePlan, type OfflinePlan } from "@/lib/tripMode";

function counted(forms: { one: string; two: string; few: string; many: string }, n: number): string {
  const f = n === 1 ? forms.one : n === 2 ? forms.two : n <= 10 ? forms.few : forms.many;
  return f.replace("{n}", String(n));
}

export function appOfflinePlan(plan: SmartPlan, locale: "ar" | "en"): OfflinePlan {
  const dict = getDictionary(locale);
  const t = dict.smart;
  const tm = dict.tripMode;
  const isAr = locale === "ar";
  const fmt = (iso: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
          new Date(`${iso}T00:00:00Z`),
        )
      : iso;
  const route = plan.route && plan.route.length > 1 ? plan.route : null;
  const country = findCountry(plan.city.code);
  const countryName = country ? (isAr ? country.nameAr : country.nameEn) : plan.city.name;
  const title = route ? `${t.routeTitle} ${isAr ? "في" : "in"} ${countryName}` : t.title.replace("{city}", plan.city.name);
  const places = plan.days.reduce((n, d) => n + d.items.filter((i) => i.kind === "place").length, 0);
  const subtitle = `${fmt(plan.from)} – ${fmt(plan.to)} · ${counted(t.daysWord, plan.days.length)} · ${counted(t.placesWord, places)}`;
  return buildOfflinePlan({
    locale,
    id: offlinePlanId(plan.city.code, plan.city.slug, plan.from, plan.to, Boolean(route)),
    title,
    subtitle,
    summary: plan.summary,
    place: route ? countryName : plan.city.name,
    city: plan.city,
    from: plan.from,
    to: plan.to,
    days: plan.days,
    essentials: plan.essentials,
    words: {
      day: t.day,
      prayersTitle: t.prayersTitle,
      prayers: t.prayers,
      weather: t.weather,
      wear: t.wear,
      packing: t.packing,
      etiquette: t.etiquette,
      transport: t.transport,
      money: t.money,
      phrases: t.phrases,
      safety: t.safety,
      emergency: t.emergency,
      onMap: tm.onMap,
      dayRoute: tm.dayRoute,
      before: tm.before,
      offlineBadge: tm.offlineBadge,
      keptOn: tm.keptOn,
      nWeekTitle: tm.nWeekTitle,
      nWeekBody: tm.nWeekBody,
      nThreeTitle: tm.nThreeTitle,
      nThreeBody: tm.nThreeBody,
      nDepartTitle: tm.nDepartTitle,
      nDepartBody: tm.nDepartBody,
      nDayTitle: tm.nDayTitle,
      nDayBody: tm.nDayBody,
      nPrayerTitle: tm.nPrayerTitle,
      nPrayerBody: tm.nPrayerBody,
    },
  });
}
