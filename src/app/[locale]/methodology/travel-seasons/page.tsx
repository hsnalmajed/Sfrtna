import { notFound } from "next/navigation";

// The travel-season methodology is internal: sources and method are not
// shown to visitors (1 Oct 2026). The text lives in
// docs/travel-seasons-methodology.md; this address answers "not found".
export default function TravelSeasonsMethodologyPage(): never {
  notFound();
}
