export type Locale = "ar" | "en";

export type TripType = "flight" | "hotel" | "both";

// Room type/bed configuration — affects which room gets searched, so it
// matters for result accuracy. Mirrors the categories real hotel sites use:
// single (one bed, one guest), twin (two separate beds in the same room),
// double (one double/queen/king bed), triple (3+ beds, family-sized),
// suite (separate living area), apartment (a full self-contained unit).
export type RoomType = "single" | "twin" | "double" | "triple" | "suite" | "apartment";

// Passenger composition, matching how flight/hotel sites break down
// travelers: adults (13+), children (ages 1-12, one age per child so fares
// can be priced correctly), and infants (under 1, usually free/near-free).
export interface TravelerCounts {
  adults: number;
  childrenAges: number[];
  infants: number;
}

export interface SearchParams {
  tripType: TripType;
  origin: string; // IATA code or city name
  destination: string; // IATA code or city name
  departDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD
  adults: number;
  budgetTotal: number;
  currency: string; // e.g. SAR, USD
  directFlightsOnly: boolean;
  minHotelStars: number; // 0-5, 0 = any
  // Optional filters: undefined/false = no filter applied (results of both
  // kinds are shown, with the info still displayed on each option).
  baggageIncluded?: boolean;
  breakfastIncluded?: boolean;
  childrenAges?: number[];
  infants?: number;
  roomType?: RoomType; // undefined = no preference
}

export interface FlightOffer {
  id: string;
  airline: string;
  airlineCode: string;
  origin: string;
  destination: string;
  departTime: string;
  arriveTime: string;
  durationMinutes: number;
  stops: number;
  price: number;
  currency: string;
  isMock: boolean;
  bookingHint: string;
  // City (IATA code) of the first layover, and how long it lasts — null when
  // the flight is direct (stops === 0).
  layoverCity: string | null;
  layoverDurationMinutes: number | null;
  baggageIncluded: boolean;
  /**
   * The source gave us a price and a carrier and little else.
   *
   * Travelpayouts' free tier returns the cheapest fares *observed* on a
   * route — no arrival time, no duration, no stop count, no baggage rule.
   * Rather than compute a plausible-looking timeline from a great-circle
   * distance and present it as fact, offers from such a source say so, and
   * the card drops the fields it cannot honestly fill.
   */
  priceOnly?: boolean;
  /** True when `stops` is something the source actually told us. */
  stopsKnown?: boolean;
  /**
   * Priced from the fares seen on the trip's own days: 0 when both days had
   * a fare, otherwise how many days away the nearest seen fare was.
   */
  nearDays?: number;
  /**
   * The fare for one adult, when `price` is that fare multiplied by the
   * party. Cached sources quote a single seat; the card shows both so nobody
   * compares our total against a per-seat price on the partner's site.
   */
  pricePerPerson?: number;
  /**
   * The price was observed somewhere in that month, not on the exact days
   * asked for. Shown as such — a real number for nearly the right dates is
   * useful; the same number presented as today's answer is not.
   */
  datesApproximate?: boolean;
  /** When the price was seen, for sources that quote rather than book. */
  observedAt?: string;
}

export interface HotelOffer {
  id: string;
  name: string;
  stars: number;
  city: string;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  nights: number;
  rating?: number;
  address?: string;
  isMock: boolean;
  bookingHint: string;
  distanceFromCenterKm: number;
  breakfastIncluded: boolean;
  roomType: RoomType;
  /**
   * How many of that room the party needs.
   *
   * Almost always one. A group larger than the biggest single unit cannot be
   * sold one room, and the honest answer is two — not an empty result list,
   * which is what a party of seven used to get, and not a six-person
   * apartment quietly offered to seven people. When this is above one the
   * price already covers all of them.
   */
  units?: number;
  /**
   * A photo of the property, when the booking provider supplies one. Absent
   * for demo data — the interface shows a designed tile rather than a stock
   * picture, since a generic image beside a hotel name reads as a photo of
   * that hotel.
   */
  photoUrl?: string;
  /**
   * The source gave a price and a name and little else.
   *
   * Hotellook's cached prices carry no distance from the centre, no board
   * basis and no room type. Rather than print a guess beside a real number,
   * an offer marked this way tells the card to drop those lines.
   */
  priceOnly?: boolean;
  /** When the price was seen, for sources that quote rather than book. */
  observedAt?: string;
}

export interface PackageCombo {
  flight?: FlightOffer;
  hotel?: HotelOffer;
  totalPrice: number;
  currency: string;
  withinBudget: boolean;
  remainingBudget: number;
}

export interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
  mealsSuggestion?: string;
  estimatedCost?: string;
}

export interface ItineraryResult {
  destination: string;
  days: number;
  summary: string;
  plan: ItineraryDay[];
  tips: string[];
  isMock: boolean;
}

// A loose taste-based taxonomy for the "suggest a destination" flow — lets
// the user steer suggestions toward what they actually enjoy rather than
// just budget-fit. Each destination in destinations.ts carries 1-3 of these.
export type DestinationCategory = "beach" | "nature" | "adventure" | "city" | "culture" | "family";

export interface DiscoverParams {
  origin: string;
  tripType: TripType;
  budgetTotal: number;
  currency: string;
  departDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD — nights are derived from depart/return
  nights: number;
  adults: number;
  directFlightsOnly: boolean;
  minHotelStars: number;
  multiDestination: boolean;
  oneWayOnly?: boolean;
  baggageIncluded?: boolean;
  breakfastIncluded?: boolean;
  childrenAges?: number[];
  infants?: number;
  roomType?: RoomType;
  preferenceCategory?: DestinationCategory;
}

/**
 * What we know about a suggested destination as a place, beside its fare —
 * all from data the site holds and has checked, and absent when unknown.
 */
export interface DestinationPlace {
  countryCode: string;
  citySlug: string;
  /** The city's English name, which the hotel partners search by. */
  cityNameEn: string;
  /** Mean afternoon high and rainy days in the month of travel. */
  high?: number;
  rainyDays?: number;
  /** In season that month by the site's rule; undefined when we can't say. */
  inSeason?: boolean;
  /** Confirmed entry status for a Saudi passport. */
  visa?: "free" | "arrival" | "eta" | "required";
}

export interface DestinationSuggestion {
  place?: DestinationPlace;
  destinationCode: string;
  destinationNameAr: string;
  destinationNameEn: string;
  emoji: string;
  // Optional because "discover" can be scoped to flights-only or
  // hotels-only, in which case only one side of the trip is priced.
  flight?: FlightOffer;
  hotel?: HotelOffer;
  nights: number;
  totalPrice: number;
  currency: string;
  withinBudget: boolean;
  remainingBudget: number;
}

export interface DestinationPairSuggestion {
  legs: [DestinationSuggestion, DestinationSuggestion];
  totalPrice: number;
  currency: string;
  withinBudget: boolean;
  remainingBudget: number;
}

// --- Multi-city ("تعدد وجهات") trip planning ---
// A user-specified sequence of destinations, each with a number of nights,
// starting and ending at the same origin city — e.g. Riyadh -> Istanbul (3
// nights) -> Paris (4 nights) -> Barcelona (2 nights) -> Riyadh.

export type FlightRoute = "roundtrip" | "oneway" | "multicity";

/** One flight of a multi-city trip, as the traveller entered it. */
export interface MultiCityLegInput {
  origin: string; // city name or IATA code
  destination: string;
  date: string; // YYYY-MM-DD
}

export interface MultiCitySearchParams {
  legs: MultiCityLegInput[];
  adults: number;
  childrenAges?: number[];
  infants?: number;
  budgetTotal: number;
  currency: string;
  directFlightsOnly: boolean;
  baggageIncluded?: boolean;
}

export interface MultiCityLegResult {
  origin: string;
  originIata: string;
  destination: string;
  destinationIata: string;
  date: string;
  /** Cheapest fare seen for this one-way flight; null when none was seen. */
  flight: FlightOffer | null;
}

export interface MultiCityTripResult {
  legs: MultiCityLegResult[];
  /** Sum of the fares found. Meaningful only when every flight was priced. */
  totalPrice: number;
  allPriced: boolean;
  currency: string;
  budgetTotal: number;
  withinBudget: boolean;
  remainingBudget: number;
  isMock: boolean;
}

/** One flight of a suggested multi-country route. */
export interface RouteLeg {
  from: string; // IATA
  to: string; // IATA
  date: string; // YYYY-MM-DD, the day the traveller flies
  /** Whole party, in the search currency. */
  price: number;
  pricePerSeat: number;
  airline: string;
  /** Stops as the source stated them; null when it didn't. */
  transfers: number | null;
  /** The fare was seen for another day that month. */
  approximate: boolean;
}

/** One country on a suggested route, and how long the traveller stays. */
export interface RouteStop {
  code: string; // IATA
  nameAr: string;
  nameEn: string;
  emoji: string;
  nights: number;
  arrive: string; // YYYY-MM-DD
  place?: DestinationPlace;
}

/** Home → A → B (→ C) → home, every flight priced. */
export interface RouteSuggestion {
  stops: RouteStop[];
  legs: RouteLeg[];
  totalPrice: number;
  currency: string;
  withinBudget: boolean;
  remainingBudget: number;
}
