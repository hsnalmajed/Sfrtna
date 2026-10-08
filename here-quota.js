// HERE's free tier is 5,000 transactions a month. A busy day must not spend
// next week's share, and the month must never run into billing. The edge
// cache is per data centre, so it cannot count for the whole site; this
// Durable Object is one counter for every location (strongly consistent,
// one request at a time), free on the Workers free plan (SQLite-backed).
//
// take(dailyCap, monthlyCap): counts one transaction and answers ok:true, or
// answers ok:false without counting when today's or this month's cap is
// reached. usage(): the counts, for /api/health. Days and months are UTC.

import { DurableObject } from "cloudflare:workers";

function stamps() {
  const iso = new Date().toISOString();
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
}

export class HereQuota extends DurableObject {
  async counts() {
    const { day, month } = stamps();
    const [today, thisMonth] = await Promise.all([
      this.ctx.storage.get(`day:${day}`),
      this.ctx.storage.get(`month:${month}`),
    ]);
    return { day, month, today: Number(today) || 0, thisMonth: Number(thisMonth) || 0 };
  }

  async take(dailyCap, monthlyCap) {
    const c = await this.counts();
    if (c.today >= dailyCap || c.thisMonth >= monthlyCap) {
      return { ok: false, today: c.today, month: c.thisMonth };
    }
    const today = c.today + 1;
    const thisMonth = c.thisMonth + 1;
    await this.ctx.storage.put({ [`day:${c.day}`]: today, [`month:${c.month}`]: thisMonth });
    // Old days are not needed: keep the store to a handful of keys.
    if (today === 1) {
      const old = await this.ctx.storage.list({ prefix: "day:" });
      const stale = [...old.keys()].filter((k) => k !== `day:${c.day}`);
      if (stale.length) await this.ctx.storage.delete(stale);
    }
    return { ok: true, today, month: thisMonth };
  }

  async usage() {
    const c = await this.counts();
    return { today: c.today, month: c.thisMonth };
  }
}
