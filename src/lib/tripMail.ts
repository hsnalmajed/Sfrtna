"use client";

/**
 * Trip reminders by email (item 5 «رحلة المسافر»): the traveller's own yes or
 * no, kept in the account with when and where it was given (/api/me/consent,
 * table `consent` in accounts.js). Nothing here ever says yes for them.
 */

export interface TripMailConsent {
  tripMail: boolean;
  at: number;
  src: string;
  locale: string;
}

export type TripMailSource = "save_card" | "account" | "my_trip";

/** Records the answer; true when the server kept it. */
export async function setTripMail(on: boolean, src: TripMailSource, locale: string): Promise<boolean> {
  try {
    const res = await fetch("/api/me/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripMail: on, src, locale }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The stored answer: null = never asked, undefined = could not be read. */
export async function getTripMail(): Promise<TripMailConsent | null | undefined> {
  try {
    const res = await fetch("/api/me/consent", { cache: "no-store" });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { ok: boolean; consent?: TripMailConsent | null };
    return json.ok ? (json.consent ?? null) : undefined;
  } catch {
    return undefined;
  }
}
