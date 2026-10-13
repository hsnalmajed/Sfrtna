"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { PENDING_PLAN_KEY, refreshAccount, useAccount } from "@/lib/useAccount";

export interface PlanToSave {
  source: "pick" | "auto";
  from: string;
  to: string;
  days: { key: string }[][];
  short: boolean;
}

/** The city page this planner is on: /{locale}/(attractions|maps)/{CODE}/{slug}. */
function citySlug(): string {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] || "");
}

/**
 * «احفظ الخطة»: keeps the plan in the traveller's account (the places by
 * key; the page rebuilds the rest). Signed out, the plan waits in this tab
 * while they sign in, is saved right after, and they come back to it.
 */
export default function SavePlanButton({
  locale,
  plan,
  title,
  cityName,
  countryCode,
  className = "",
}: {
  locale: Locale;
  plan: PlanToSave;
  title: string;
  cityName: string;
  countryCode: string;
  /** The look of the button (it sits in the plan's toolbar). */
  className?: string;
}) {
  const t = getDictionary(locale).account;
  const account = useAccount();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error" | "full">("idle");

  const enabled = account.status === "ready" && (account.user || account.methods.email || account.methods.google);
  if (!enabled) return null;

  const body = () =>
    JSON.stringify({
      title,
      plan: {
        code: countryCode.toUpperCase(),
        slug: citySlug(),
        city: cityName,
        locale,
        source: plan.source,
        from: plan.from,
        to: plan.to,
        days: plan.days.map((d) => d.map((p) => p.key)),
        short: plan.short,
      },
    });

  function signInFirst() {
    try {
      sessionStorage.setItem(PENDING_PLAN_KEY, body());
    } catch {
      // Private mode: they can save again after signing in.
    }
    const here = new URL(window.location.href);
    here.searchParams.delete("saved");
    here.searchParams.set("from", plan.from);
    here.searchParams.set("to", plan.to);
    here.hash = "trip-plan";
    router.push(`/${locale}/account?next=${encodeURIComponent(here.pathname + here.search + here.hash)}`);
  }

  async function save() {
    if (!account.user) return signInFirst();
    setState("saving");
    // One quiet retry: a dropped connection should not cost the plan.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: body() });
        if (res.status === 401) {
          // The sign-in ended (signed out on another page, or expired).
          await refreshAccount();
          setState("idle");
          return signInFirst();
        }
        const json = (await res.json().catch(() => ({ ok: false, reason: `http_${res.status}` }))) as { ok: boolean; reason?: string };
        if (json.ok) return setState("saved");
        if (json.reason === "too_many") return setState("full");
        console.warn("[sfrtna] save plan:", res.status, json.reason);
        if (res.status < 500) break;
      } catch (err) {
        console.warn("[sfrtna] save plan:", err);
      }
    }
    setState("error");
  }

  const label =
    state === "saving" ? t.saving : state === "saved" ? t.saved : account.user ? t.savePlan : t.saveSignIn;

  const failed = state === "error" || state === "full";
  return (
    <button
      type="button"
      onClick={save}
      disabled={state === "saving" || state === "saved"}
      title={failed ? (state === "full" ? t.tooManyPlans : t.saveFailed) : undefined}
      className={`${className} ${state === "saved" ? "!bg-emerald-600" : failed ? "!bg-rose-700" : ""}`}
    >
      <span aria-hidden="true">{state === "saved" ? "✓" : failed ? "⚠️" : "💾"}</span>{" "}
      {failed ? (state === "full" ? t.tooManyPlans : t.saveFailed) : label}
    </button>
  );
}
