import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import PageHero from "@/components/ui/PageHero";
import { sectionHero } from "@/lib/sectionHero";
import BudgetAdvisor from "@/components/smart/BudgetAdvisor";

// Travel tools → «مستشار الميزانية» (src/components/smart/BudgetAdvisor.tsx).
export async function generateMetadata({ params }: PageProps<"/[locale]/budget">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return pageMetadata({ locale: loc, path: "/budget", title: dict.budgetAdvisor.title, description: dict.budgetAdvisor.subtitle });
}

export default async function BudgetPage({ params }: PageProps<"/[locale]/budget">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  const hero = await sectionHero("itinerary", loc);
  return (
    <div>
      <PageHero {...hero} size="sm" title={dict.budgetAdvisor.title} subtitle={dict.budgetAdvisor.subtitle} />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <BudgetAdvisor locale={loc} />
      </div>
    </div>
  );
}
