import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LANG_COOKIE } from "@/lib/langCookie";

const locales = ["ar", "en"];
const defaultLocale = "ar";

export default async function RootPage() {
  // The language the visitor last used (NavTracker sets it), then the
  // browser's own, then Arabic.
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (saved && locales.includes(saved)) redirect(`/${saved}`);
  const h = await headers();
  const acceptLanguage = h.get("accept-language") || "";
  const preferred = acceptLanguage.split(",")[0]?.split("-")[0]?.toLowerCase();
  const locale = locales.includes(preferred) ? preferred : defaultLocale;
  redirect(`/${locale}`);
}
