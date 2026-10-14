// The "When to travel?" page hands every city's twelve months to the
// browser. Sent as objects, the same key names and the same few dozen
// sentences ("Cool with occasional rain", "Rainy winter"…) repeat ~1,700
// times — about half a megabyte of page data to parse on a phone. Packed,
// each month is a short row of numbers pointing into one table of the
// distinct strings, and the browser rebuilds the same objects once.
//
// Shared by the server page (pack) and the client list (unpack); keep it
// free of server-only imports.

export interface PlainMonth {
  classification: string | null;
  finalScore: number | null;
  season: string;
  pattern: string | null;
  seasonName: string;
  seasonIcon: string;
  phase: string | null;
  high: number | null;
  low: number | null;
  rainDays: number | null;
  summary: string | null;
  reason: string | null;
}

/** [classification, finalScore, season, pattern, seasonName, seasonIcon, phase, high, low, rainDays, summary, reason] — strings as table indexes, null as -1 (strings) or null (numbers). */
export type PackedMonth = [number, number | null, number, number, number, number, number, number | null, number | null, number | null, number, number];

export class SeasonPacker {
  readonly table: string[] = [];
  private index = new Map<string, number>();

  private s(v: string | null): number {
    if (v === null) return -1;
    let i = this.index.get(v);
    if (i === undefined) {
      i = this.table.length;
      this.table.push(v);
      this.index.set(v, i);
    }
    return i;
  }

  month(m: PlainMonth): PackedMonth {
    return [
      this.s(m.classification),
      m.finalScore,
      this.s(m.season),
      this.s(m.pattern),
      this.s(m.seasonName),
      this.s(m.seasonIcon),
      this.s(m.phase),
      m.high,
      m.low,
      m.rainDays,
      this.s(m.summary),
      this.s(m.reason),
    ];
  }
}

export function unpackMonth(p: PackedMonth, table: readonly string[]): PlainMonth {
  const s = (i: number) => (i < 0 ? null : table[i]);
  return {
    classification: s(p[0]),
    finalScore: p[1],
    season: s(p[2]) ?? "",
    pattern: s(p[3]),
    seasonName: s(p[4]) ?? "",
    seasonIcon: s(p[5]) ?? "",
    phase: s(p[6]),
    high: p[7],
    low: p[8],
    rainDays: p[9],
    summary: s(p[10]),
    reason: s(p[11]),
  };
}
