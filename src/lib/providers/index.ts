import type { FlightOffer, SearchParams } from "@/lib/types";
import type { PriceProvider } from "./types";
import { travelpayouts } from "./travelpayouts";

/**
 * Every price source the site knows about, in the order it asks them.
 *
 * Order is preference, not fallback-on-error alone: the first configured
 * provider that returns anything wins. When there are two live sources this
 * becomes a merge rather than a race — that is the point of the layer, and
 * the reason it exists before the second source does. A comparison site with
 * one supplier is not comparing; it is reselling one company's opinion.
 *
 * Adding a source is adding a file next to this one and a line below.
 *
 * A function rather than a constant: travelpayouts.ts imports flights.ts,
 * which imports this file, so when a page loads travelpayouts first the
 * binding is not initialised yet while this module is evaluated.
 */
const providers = (): PriceProvider[] => [travelpayouts];

export function configuredProviders(): PriceProvider[] {
  return providers().filter((p) => p.isConfigured());
}

/**
 * Ask each configured provider in turn and return the first non-empty answer.
 *
 * A provider that throws is treated as one that said nothing: the contract in
 * types.ts asks them not to throw, but a network stack can always surprise us
 * and one bad supplier must not take the page down with it.
 */
export async function searchFlightsFromProviders(
  params: SearchParams
): Promise<{ offers: FlightOffer[]; source: string | null }> {
  for (const provider of configuredProviders()) {
    if (!provider.searchFlights) continue;
    try {
      const offers = await provider.searchFlights(params);
      if (offers.length > 0) return { offers, source: provider.name };
    } catch (err) {
      console.error(`Price provider ${provider.name} failed for flights:`, err);
    }
  }
  return { offers: [], source: null };
}
