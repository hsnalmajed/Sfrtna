"use client";

import { useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { refreshAccount, useAccount } from "@/lib/useAccount";
import { openJoin } from "@/components/member/events";
import { track } from "@/lib/analytics";

export interface PlanForMail {
  from: string;
  to: string;
  days: { name: string; lat?: number; lon?: number }[][];
}

/** The city page this planner is on: /{locale}/(attractions|maps)/{CODE}/{slug}. */
function citySlug(): string {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] || "");
}

/**
 * «أرسل الخطة إلى بريدي» (growth doc item 5, step 2): the plan, day by day,
 * mailed to the address of the traveller's own account — on his phone during
 * the trip. Signed out, the «create your account» sheet opens first.
 */
export default function MailPlanButton({
  locale,
  plan,
  cityName,
  countryCode,
  className = "",
}: {
  locale: Locale;
  plan: PlanForMail;
  cityName: string;
  countryCode: string;
  className?: string;
}) {
  const t = useDictionary().tripPlan;
  const account = useAccount();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "limit" | "no_email">("idle");

  const enabled = account.status === "ready" && (account.user || account.methods.email || account.methods.google);
  if (!enabled) return null;

  async function send() {
    if (!account.user) {
      track("join_prompt", { reason: "plan_mail" });
      return openJoin("generic");
    }
    if (!account.user.email) return setState("no_email");
    setState("sending");
    try {
      const res = await fetch("/api/plans/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          code: countryCode.toUpperCase(),
          slug: citySlug(),
          city: cityName,
          from: plan.from,
          to: plan.to,
          days: plan.days.map((d) =>
            d.map((p) => (typeof p.lat === "number" && typeof p.lon === "number" ? { name: p.name, lat: p.lat, lon: p.lon } : { name: p.name }))
          ),
        }),
      });
      if (res.status === 401) {
        await refreshAccount();
        setState("idle");
        return openJoin("generic");
      }
      const json = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; reason?: string };
      if (json.ok) {
        track("plan_mail", { days: plan.days.length });
        return setState("sent");
      }
      setState(json.reason === "limit" ? "limit" : json.reason === "no_email" ? "no_email" : "error");
    } catch {
      setState("error");
    }
  }

  const label =
    state === "sending"
      ? t.mailPlanSending
      : state === "sent"
        ? t.mailPlanSent
        : state === "limit"
          ? t.mailPlanLimit
          : state === "no_email"
            ? t.mailPlanNoEmail
            : state === "error"
              ? t.mailPlanFailed
              : t.mailPlan;
  const bad = state === "error" || state === "limit" || state === "no_email";
  return (
    <button
      type="button"
      onClick={send}
      disabled={state === "sending" || state === "sent" || state === "limit" || state === "no_email"}
      aria-live="polite"
      className={`${className} ${state === "sent" ? "!bg-emerald-600 !text-white" : bad ? "!bg-rose-700 !text-white" : ""}`}
    >
      <span aria-hidden="true">{state === "sent" ? "✓" : bad ? "⚠️" : "✉️"}</span> {label}
    </button>
  );
}
