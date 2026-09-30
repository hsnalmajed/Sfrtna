import type { Classification } from "./config.ts";

/** The dot shown before each rating, everywhere on the site. */
export const CLASS_DOT: Record<Classification, string> = {
  EXCELLENT: "🟢",
  VERY_GOOD: "🟢",
  GOOD: "🟡",
  ACCEPTABLE: "🟠",
  NOT_RECOMMENDED: "🔴",
};
