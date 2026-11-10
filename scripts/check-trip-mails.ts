// Checks the trip-mail schedule and texts (src/lib/tripMails.ts) without
// sending anything: `npx tsx scripts/check-trip-mails.ts [out-dir]`.
// Writes each rendered mail as HTML to out-dir when given (to look at).
import { writeFileSync } from "node:fs";
import { dueKind, linesFor, renderMail, type Candidate } from "../src/lib/tripMails";
import { tripKey, type Trip } from "../src/lib/memberItems";

const H = 3_600_000;
// 10 Dec 2026, 10:00 Riyadh = 07:00 UTC
const at = (iso: string, hourRiyadh: number) => Date.parse(`${iso}T00:00:00Z`) + (hourRiyadh - 3) * H;
const base: Trip = { origin: "RUH", destination: "IST", code: "TR", slug: "istanbul", cityAr: "إسطنبول", cityEn: "Istanbul", depart: "2026-12-10", back: "2026-12-17", adults: 2, childrenAges: [5], infants: 0, booked: false, done: [], pickedAt: at("2026-11-20", 2) };
const cand = (t: Trip, sent: Candidate["sent"] = [], locale = "ar"): Candidate => ({ locale, key: tripKey(t), trip: t, sent });

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

eq("before 1 h: nothing", dueKind(cand(base), base.pickedAt! + 30 * 60e3), null);
eq("after 1 h, even at night: ready", dueKind(cand(base), base.pickedAt! + 61 * 60e3), "ready");
eq("after 25 h: ready window closed", dueKind(cand(base), base.pickedAt! + 25 * H), null);
eq("ready lines (all open)", linesFor("ready", base, "ar").map((l) => l.id), ["visa", "hotel", "esim", "transfer", "activities"]);
const ticked = { ...base, done: ["visa", "services"] as Trip["done"] };
eq("ready lines skip ticked", linesFor("ready", ticked, "ar").map((l) => l.id), ["hotel"]);
const allDone = { ...base, done: ["visa", "services", "hotel", "plan"] as Trip["done"] };
eq("all ticked: no ready mail", dueKind(cand(allDone), base.pickedAt! + 2 * H), null);
const sentReady = [{ kind: "ready", at: base.pickedAt! + 2 * H }];
eq("week, daytime 6 days before", dueKind(cand(base, sentReady), at("2026-12-04", 10)), "week");
eq("week, at night: wait", dueKind(cand(base, sentReady), at("2026-12-04", 23)), null);
eq("one a day per trip", dueKind(cand(base, [{ kind: "week", at: at("2026-12-04", 10) }]), at("2026-12-04", 20)), null);
eq("esim 3 days before", dueKind(cand(base, [{ kind: "week", at: at("2026-12-04", 10) }]), at("2026-12-07", 10)), "esim");
eq("esim skipped when services ticked", dueKind(cand({ ...base, done: ["services"] }), at("2026-12-07", 10)), null);
eq("arrival day", dueKind(cand(base), at("2026-12-10", 12)), "arrival");
eq("arrival lines when services ticked", linesFor("arrival", { ...base, done: ["services", "plan"] }, "ar").map((l) => l.id), ["plan"]);
eq("after return +2 days", dueKind(cand(base), at("2026-12-19", 12)), "after");
eq("after return +5 days: too late", dueKind(cand(base), at("2026-12-22", 12)), null);
eq("one-way: no after mail", dueKind(cand({ ...base, back: undefined }), at("2026-12-12", 12)), null);
eq("max 5 per trip", dueKind(cand(base, ["ready", "week", "esim", "arrival", "x"].map((k) => ({ kind: k, at: 0 }))), at("2026-12-19", 12)), null);
eq("not picked: nothing", dueKind(cand({ ...base, pickedAt: undefined }), at("2026-12-04", 10)), null);
eq("Saudi city: no visa line", linesFor("ready", { ...base, destination: "JED", code: "SA", slug: "jeddah", cityAr: "جدة", cityEn: "Jeddah" }, "ar").map((l) => l.id).includes("visa"), false);
eq("bad stored trip: nothing", dueKind({ locale: "ar", key: "x", trip: { evil: 1 }, sent: [] }, base.pickedAt! + 2 * H), null);

const out = process.argv[2];
const unsub = "a".repeat(64);
for (const [kind, locale] of [["ready", "ar"], ["week", "ar"], ["esim", "ar"], ["arrival", "ar"], ["after", "ar"], ["ready", "en"]] as const) {
  const m = renderMail(kind, base, locale, unsub, "https://sfrtna.com")!;
  const priceLike = /\d+\s*(SAR|ر\.س|ريال|\$|USD)/.test(m.text);
  eq(`${kind}/${locale}: has unsubscribe, no prices`, [m.html.includes(`/api/unsub?t=${unsub}`), priceLike], [true, false]);
  console.log(`     subject: ${m.subject}`);
  if (out) writeFileSync(`${out}/${kind}-${locale}.html`, m.html);
}
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
