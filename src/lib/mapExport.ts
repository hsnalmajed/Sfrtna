// Turns the pins we already show on a country map into the two file formats
// phone map apps actually accept, so a traveller can carry the map with them
// instead of needing our site open.
//
//   GPX — the navigation standard. Organic Maps, OsmAnd, Maps.me, Guru Maps,
//         Gaia, Garmin. Best choice for offline use while travelling.
//   KML — Google's format. Google Earth opens it directly, and it's what
//         Google My Maps imports.
//
// Both are generated in the browser from data already on the page: no server
// round-trip, and no third-party service sees the traveller's itinerary.

import { inApp, shareFileInApp } from "@/lib/nativeApp";

export interface ExportPlace {
  name: string;
  lat: number;
  lon: number;
  description?: string;
  category?: string;
}

// GPX and KML are plain XML, so anything that reaches an element body or an
// attribute has to be escaped — landmark names really
// do contain & and quotes.
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Coordinates are written with a fixed precision: ~1 cm, far beyond what a
// landmark pin needs, and avoids exponent notation that some parsers reject.
function coord(n: number): string {
  return n.toFixed(7);
}

export function toGPX(places: ExportPlace[], title: string): string {
  const waypoints = places
    .map(
      (p) =>
        `  <wpt lat="${coord(p.lat)}" lon="${coord(p.lon)}">\n` +
        `    <name>${xmlEscape(p.name)}</name>\n` +
        (p.description ? `    <desc>${xmlEscape(p.description)}</desc>\n` : "") +
        (p.category ? `    <type>${xmlEscape(p.category)}</type>\n` : "") +
        `  </wpt>`
    )
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Sfrtna" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata>\n    <name>${xmlEscape(title)}</name>\n  </metadata>\n` +
    `${waypoints}\n` +
    `</gpx>\n`
  );
}

export function toKML(places: ExportPlace[], title: string): string {
  const placemarks = places
    .map(
      (p) =>
        `    <Placemark>\n` +
        `      <name>${xmlEscape(p.name)}</name>\n` +
        (p.description ? `      <description>${xmlEscape(p.description)}</description>\n` : "") +
        // KML orders coordinates lon,lat,altitude — the reverse of GPX.
        `      <Point><coordinates>${coord(p.lon)},${coord(p.lat)},0</coordinates></Point>\n` +
        `    </Placemark>`
    )
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2">\n` +
    `  <Document>\n    <name>${xmlEscape(title)}</name>\n` +
    `${placemarks}\n` +
    `  </Document>\n</kml>\n`
  );
}

// Keeps filenames safe across Android, iOS and desktop: no separators, no
// characters Windows rejects, and never empty.
export function safeFileName(base: string, extension: string): string {
  const cleaned = base
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `${cleaned || "sfrtna-map"}.${extension}`;
}

export function downloadText(content: string, fileName: string, mimeType: string): void {
  // Inside the phone app a WebView cannot save a download: the file goes to
  // the share sheet instead (open in a maps app, save to Files, send).
  if (inApp()) {
    void shareFileInApp(fileName, mimeType, content).then((shared) => {
      if (!shared) browserDownload(content, fileName, mimeType);
    });
    return;
  }
  browserDownload(content, fileName, mimeType);
}

function browserDownload(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the blob goes.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
