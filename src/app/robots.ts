import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * What crawlers should and shouldn't spend their time on.
 *
 * The results pages are built from a visitor's own query — origin, dates,
 * budget, party — so every one is unique, none is useful to anyone else, and
 * left open they would be an unbounded space for a crawler to wander into
 * while the pages that matter go unvisited.
 *
 * Crawlers that copy pages to train AI models are refused the whole site:
 * the guides, season ratings and visa lists are our own work, and a model
 * trained on them answers in our place without sending anyone here.
 *
 * Crawlers that fetch a page because someone asked an AI assistant a
 * question (ChatGPT search, Perplexity, Claude) are allowed, the same as a
 * search engine — they quote the page with a link back, which brings
 * visitors. Owner's decision, 7 Oct 2026. They follow the "*" rules, so the
 * results pages and /api stay closed to them too.
 *
 * robots.txt is a request, not a lock: the well-behaved crawlers below obey
 * it, and Cloudflare's "Block AI bots" setting and the /api guard in
 * edge-guard.js deal with the ones that don't.
 */
const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "CCBot",
  "Google-Extended",
  "GoogleOther",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
  "FacebookBot",
  "Amazonbot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "Omgilibot",
  "omgili",
  "Webzio-Extended",
  "AI2Bot",
  "Ai2Bot-Dolma",
  "ImagesiftBot",
  "Timpibot",
  "PanguBot",
  "Kangaroo Bot",
  "img2dataset",
  "Scrapy",
  "YouBot",
  "VelenPublicWebCrawler",
  "ICC-Crawler",
  "Sidetrade indexer bot",
];

const CLOSED = ["/api/", "/*/results", "/*/discover-results", "/*/multicity-results", "/*/hotel-results"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_TRAINING_CRAWLERS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: CLOSED },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
