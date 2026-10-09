import type { FlightOffer, SearchParams } from "@/lib/types";

/**
 * A source of prices.
 *
 * The site used to call one provider directly from `flights.ts`, which made
 * "which provider" a fact buried in the middle of a search function. That was
 * fine while there was one and became a problem the moment there were two —
 * and there have to be two eventually, because a comparison site with a
 * single source is not comparing anything.
 *
 * So a provider is a small object with a name, a way to say whether it is
 * configured, and a search. The registry in ./index.ts asks each configured
 * provider in turn. Adding a second source is adding a file here; nothing
 * upstream changes.
 *
 * Every provider must obey two rules, and both exist because this site shows
 * money to strangers:
 *
 *  - **Never invent.** A field the source did not give us is left out, not
 *    estimated. An offer with no arrival time is marked `priceOnly` and the
 *    card drops its timeline; it does not get a plausible-looking one.
 *  - **Fail closed.** A provider that errors, times out, or returns a shape
 *    we do not recognise returns an empty array. The caller then tries the
 *    next provider, and if none answers the page says so. It never guesses.
 */
export interface PriceProvider {
  /** Shown in logs and, where a partner requires attribution, on the page. */
  readonly name: string;

  /** False when its credentials are absent — the registry then skips it. */
  isConfigured(): boolean;

  /** Flights, cheapest first. Empty array means "I have nothing", never throw. */
  searchFlights?(params: SearchParams): Promise<FlightOffer[]>;
}

