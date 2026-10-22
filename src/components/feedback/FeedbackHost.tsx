"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { useAccount } from "@/lib/useAccount";
import { appPlatform, inApp } from "@/lib/nativeApp";
import { readRecent } from "@/lib/recentSearches";
import { track } from "@/lib/analytics";
import {
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  FEEDBACK_SHOT_MAX,
  FEEDBACK_TEXT_MAX,
  FEEDBACK_TEXT_MIN,
  areaForPath,
  type FeedbackArea,
  type FeedbackKind,
} from "@/lib/feedbackShared";
import { FEEDBACK_EVENT, type FeedbackOpen } from "@/components/feedback/events";

/**
 * «شاركنا رأيك» (owner, 22 Oct 2026): mounted once in the layout.
 *
 * A small «💬 رأيك» button stays in the corner of every page (above the tab
 * bar in the app); the footer, the app's «المزيد» sheet and the yes/no
 * question under results open the same sheet through FEEDBACK_EVENT.
 *
 * Two short steps, so it never feels like a form:
 *   1. what kind of note (problem · wrong information · idea · opinion ·
 *      question) — five large tiles;
 *   2. the section (already chosen from the page, changeable), stars for an
 *      opinion, the note itself with a prompt that fits the kind, an
 *      optional screenshot (shrunk in the browser), an optional email.
 * Then a reference number. The page, device and last search travel with
 * it — the sheet says so — so "the price is wrong" arrives with context.
 */
const KIND_ICON: Record<FeedbackKind, string> = { problem: "🐞", wrong: "⚠️", idea: "💡", opinion: "💬", question: "❓" };

type Step = "kind" | "details" | "done";

export default function FeedbackHost({ locale }: { locale: Locale }) {
  const t = useDictionary().feedback;
  const account = useAccount();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("kind");
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [area, setArea] = useState<FeedbackArea>("other");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  // null = not typed yet → the signed-in member's address is offered.
  const [typedEmail, setEmail] = useState<string | null>(null);
  const [contact, setContact] = useState(true);
  const [shot, setShot] = useState<string | null>(null);
  const [shotErr, setShotErr] = useState(false);
  const [source, setSource] = useState("button");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<{ ref: string; receipt: string | null } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const hp = useRef<HTMLInputElement>(null);

  const reset = useCallback(
    (detail?: FeedbackOpen) => {
      const k = detail?.kind ?? null;
      setKind(k);
      setStep(k ? "details" : "kind");
      setArea(detail?.area ?? areaForPath(pathname, inApp()));
      setRating(0);
      setText("");
      setShot(null);
      setShotErr(false);
      setErr(null);
      setTried(false);
      setDone(null);
      setSource(detail?.source ?? "button");
    },
    [pathname]
  );

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<FeedbackOpen | undefined>).detail;
      reset(detail);
      setOpen(true);
      track("feedback_open", { source: detail?.source ?? "button" });
    };
    window.addEventListener(FEEDBACK_EVENT, onOpen);
    return () => window.removeEventListener(FEEDBACK_EVENT, onOpen);
  }, [reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open && step === "details") window.setTimeout(() => textRef.current?.focus({ preventScroll: true }), 250);
  }, [open, step]);

  const pickKind = (k: FeedbackKind) => {
    setKind(k);
    setStep("details");
  };

  async function onFile(file: File | undefined) {
    setShotErr(false);
    if (!file) return;
    try {
      setShot(await shrink(file));
    } catch {
      setShot(null);
      setShotErr(true);
    }
  }

  const email = typedEmail ?? account.user?.email ?? "";
  const emailTrim = email.trim();
  const emailOk = !emailTrim || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(emailTrim);
  const textOk = text.trim().length >= FEEDBACK_TEXT_MIN;

  async function submit() {
    setTried(true);
    if (!kind || !textOk || !emailOk || busy) return;
    setBusy(true);
    setErr(null);
    const last = readRecent()[0];
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          area,
          rating: kind === "opinion" && rating ? rating : null,
          text: text.trim(),
          email: emailTrim,
          contact: Boolean(emailTrim) && contact,
          locale,
          screenshot: shot,
          website: hp.current?.value ?? "",
          ctx: {
            page: window.location.href.slice(0, 400),
            platform: appPlatform(),
            device: deviceName(),
            screen: `${window.innerWidth}×${window.innerHeight}`,
            lastSearch: last ? `${window.location.origin}${last.url}` : "",
            source,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; receipt?: string | null; reason?: string };
      if (!res.ok || !json.ok || !json.ref) {
        setErr(json.reason === "too_many" ? t.tooMany : t.error);
        return;
      }
      track("feedback_submit", { kind, area, source, rating: kind === "opinion" ? rating : 0, screenshot: shot ? 1 : 0 });
      setDone({ ref: json.ref, receipt: json.receipt ?? null });
      setStep("done");
    } catch {
      setErr(t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, { detail: { source: "floating" } }))}
        className="lift-over-tabbar fixed bottom-4 end-3 z-[50] inline-flex h-10 items-center gap-1.5 rounded-full bg-navy-900/95 px-3.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(4,24,47,0.6)] ring-1 ring-white/15 backdrop-blur transition hover:bg-navy-800 print:hidden"
        aria-label={t.open}
      >
        <span aria-hidden="true">💬</span>
        {t.floating}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center print:hidden" role="dialog" aria-modal="true" aria-label={t.title}>
          <button type="button" aria-label={t.close} onClick={() => setOpen(false)} className="absolute inset-0 bg-navy-990/60 backdrop-blur-[2px]" />
          <div className="relative flex max-h-[92svh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:px-7 sm:pt-6">
              <div className="min-w-0">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-navy-900/15 sm:hidden" aria-hidden="true" />
                <p className="font-display text-lg font-extrabold text-navy-950">{step === "done" ? t.doneTitle : t.title}</p>
                {step !== "done" && <p className="mt-0.5 text-sm leading-relaxed text-navy-600">{t.subtitle}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mist-100 text-navy-700 hover:bg-mist-200 sm:mt-0">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
              </button>
            </div>

            {/* Steps: two dots so the visitor sees it is short. */}
            {step !== "done" && (
              <div className="flex gap-1.5 px-5 pb-3 sm:px-7" aria-hidden="true">
                <span className="h-1.5 flex-1 rounded-full bg-sun-400" />
                <span className={`h-1.5 flex-1 rounded-full ${step === "details" ? "bg-sun-400" : "bg-mist-200"}`} />
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-7 sm:pb-7">
              {step === "kind" && (
                <>
                  <p className="mb-3 text-sm font-extrabold text-navy-900">{t.kindQ}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {FEEDBACK_KINDS.map((k, i) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => pickKind(k)}
                        className={`flex min-h-[5.25rem] flex-col items-start justify-center gap-1 rounded-2xl bg-mist-50 px-3.5 py-3 text-start ring-1 ring-mist-200 transition hover:bg-sun-50 hover:ring-sun-300 active:scale-[0.98] ${
                          i === FEEDBACK_KINDS.length - 1 ? "col-span-2" : ""
                        }`}
                      >
                        <span className="text-2xl leading-none" aria-hidden="true">{KIND_ICON[k]}</span>
                        <span className="text-sm font-extrabold text-navy-950">{t.kinds[k].title}</span>
                        <span className="text-xs leading-snug text-navy-500">{t.kinds[k].hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === "details" && kind && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                  noValidate
                >
                  <button type="button" onClick={() => setStep("kind")} className="mb-4 inline-flex items-center gap-2 rounded-full bg-sun-50 px-3 py-1.5 text-sm font-bold text-navy-900 ring-1 ring-sun-300">
                    <span aria-hidden="true">{KIND_ICON[kind]}</span>
                    {t.kinds[kind].title}
                    <span className="text-xs font-bold text-navy-500">· {t.back}</span>
                  </button>

                  <p className="mb-2 text-sm font-extrabold text-navy-900">{t.areaQ}</p>
                  <div className="mb-5 flex flex-wrap gap-1.5">
                    {FEEDBACK_AREAS.filter((a) => a !== "app" || inApp()).map((a) => (
                      <button
                        key={a}
                        type="button"
                        aria-pressed={area === a}
                        onClick={() => setArea(a)}
                        className={`min-h-9 rounded-full px-3 text-[13px] font-bold ring-1 transition ${
                          area === a ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-700 ring-mist-300 hover:ring-navy-300"
                        }`}
                      >
                        {t.areas[a]}
                      </button>
                    ))}
                  </div>

                  {kind === "opinion" && (
                    <div className="mb-5">
                      <p className="mb-2 text-sm font-extrabold text-navy-900">{t.ratingQ}</p>
                      <div className="flex items-center gap-1" role="radiogroup" aria-label={t.ratingQ}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={rating === n}
                            aria-label={t.ratingLabels[n - 1]}
                            onClick={() => setRating(n)}
                            className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl transition ${n <= rating ? "text-sun-400" : "text-mist-300 hover:text-sun-200"}`}
                          >
                            ★
                          </button>
                        ))}
                        <span className="ms-2 text-sm font-bold text-navy-600">{rating ? t.ratingLabels[rating - 1] : ""}</span>
                      </div>
                    </div>
                  )}

                  <label htmlFor="fb-text" className="mb-2 block text-sm font-extrabold text-navy-900">{t.textLabel}</label>
                  <textarea
                    id="fb-text"
                    ref={textRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={FEEDBACK_TEXT_MAX}
                    rows={5}
                    placeholder={t.placeholders[kind]}
                    aria-invalid={tried && !textOk}
                    className={`w-full resize-y rounded-2xl border bg-white px-4 py-3 text-[15px] leading-relaxed text-navy-950 outline-none transition placeholder:text-navy-400 focus:ring-4 ${
                      tried && !textOk ? "border-red-400 focus:ring-red-100" : "border-mist-300 focus:border-sun-400 focus:ring-sun-400/25"
                    }`}
                  />
                  {tried && !textOk && <p className="mt-1.5 text-xs font-bold text-red-600">{t.textTooShort}</p>}

                  <div className="mt-4">
                    {shot ? (
                      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-2.5 ring-1 ring-emerald-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={shot} alt="" className="h-14 w-14 rounded-xl object-cover" />
                        <span className="flex-1 text-sm font-bold text-emerald-800">{t.attached}</span>
                        <button type="button" onClick={() => setShot(null)} className="rounded-full px-3 py-1.5 text-sm font-bold text-navy-700 hover:bg-white">
                          {t.removeShot}
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-mist-300 px-4 py-3 transition hover:border-sun-400 hover:bg-sun-50/50">
                        <span className="text-xl" aria-hidden="true">📎</span>
                        <span className="flex-1">
                          <span className="block text-sm font-bold text-navy-900">{t.attach}</span>
                          <span className="block text-xs text-navy-500">{t.attachHint}</span>
                        </span>
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
                      </label>
                    )}
                    {shotErr && <p className="mt-1.5 text-xs font-bold text-red-600">{t.shotTooBig}</p>}
                  </div>

                  <label htmlFor="fb-email" className="mb-1 mt-5 block text-sm font-extrabold text-navy-900">{t.emailLabel}</label>
                  <p className="mb-2 text-xs text-navy-500">{t.emailHint}</p>
                  <input
                    id="fb-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={tried && !emailOk}
                    className={`w-full rounded-2xl border bg-white px-4 py-3 text-[15px] text-navy-950 outline-none transition focus:ring-4 ${
                      tried && !emailOk ? "border-red-400 focus:ring-red-100" : "border-mist-300 focus:border-sun-400 focus:ring-sun-400/25"
                    }`}
                  />
                  {tried && !emailOk && <p className="mt-1.5 text-xs font-bold text-red-600">{t.emailBad}</p>}
                  {emailTrim && (
                    <label className="mt-3 flex items-start gap-2.5 text-sm text-navy-800">
                      <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} className="mt-0.5 h-5 w-5 rounded accent-sun-500" />
                      {t.contactOk}
                    </label>
                  )}

                  {/* Never shown: a script that fills every field fills this one. */}
                  <input ref={hp} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -start-[9999px] h-px w-px opacity-0" />

                  <p className="mt-5 flex gap-2 rounded-2xl bg-mist-50 px-3.5 py-2.5 text-xs leading-relaxed text-navy-600">
                    <span aria-hidden="true">🔒</span>
                    {t.context}
                  </p>

                  {err && <p className="mt-3 rounded-2xl bg-red-50 px-3.5 py-2.5 text-sm font-bold text-red-700 ring-1 ring-red-200" role="alert">{err}</p>}

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-4 w-full rounded-full bg-sun-400 px-5 py-3.5 text-center text-[15px] font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300 disabled:opacity-70"
                  >
                    {busy ? t.sending : t.send}
                  </button>
                </form>
              )}

              {step === "done" && done && (
                <div className="pb-2 pt-2 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl ring-1 ring-emerald-200" aria-hidden="true">✓</div>
                  <p className="text-[15px] leading-relaxed text-navy-800">
                    {t.doneBody.split("{ref}")[0]}
                    <span dir="ltr" className="font-extrabold text-navy-950">{done.ref}</span>
                    {t.doneBody.split("{ref}")[1]}
                  </p>
                  {done.receipt && <p className="mt-2 text-sm text-navy-600">{t.doneReceipt.replace("{email}", done.receipt)}</p>}
                  <div className="mt-6 space-y-2">
                    <button type="button" onClick={() => setOpen(false)} className="block w-full rounded-full bg-navy-900 px-5 py-3 font-extrabold text-white hover:bg-navy-800">
                      {t.close}
                    </button>
                    <button type="button" onClick={() => reset({ source })} className="block min-h-10 w-full rounded-full text-sm font-bold text-navy-600">
                      {t.another}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** "Android 14 · Pixel 7 · Chrome 141" — enough to reproduce, nothing personal. */
function deviceName(): string {
  const ua = navigator.userAgent;
  const os =
    ua.match(/Android [\d.]+/)?.[0] ??
    (ua.match(/(iPhone|iPad).*?OS ([\d_]+)/) ? `iOS ${ua.match(/OS ([\d_]+)/)?.[1].replace(/_/g, ".")}` : null) ??
    (/Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "");
  const model = ua.match(/Android [\d.]+; ([^;)]+)/)?.[1]?.trim() ?? (/(iPhone|iPad)/.exec(ua)?.[1] || "");
  const browser =
    ua.match(/SfrtnaApp\/\w+/)?.[0] ??
    ua.match(/(Edg|OPR|SamsungBrowser|Firefox|CriOS|Chrome|Version)\/[\d]+/)?.[0]?.replace("Version", "Safari") ??
    "";
  return [os, model, browser].filter(Boolean).join(" · ").slice(0, 120);
}

/** The screenshot, shrunk in the browser to at most 1600 px wide as JPEG. */
async function shrink(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.82, 0.7, 0.55]) {
      const data = canvas.toDataURL("image/jpeg", q);
      if (data.length - 23 <= FEEDBACK_SHOT_MAX) return data;
    }
    throw new Error("too big");
  } finally {
    URL.revokeObjectURL(url);
  }
}
