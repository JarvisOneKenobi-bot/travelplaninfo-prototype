import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import HelpButton from "@/components/HelpButton";
import { getAllArticles } from "@/lib/articles";
import GuidesFilter from "@/components/GuidesFilter";
import NewsletterForm from "@/components/NewsletterForm";

export const metadata: Metadata = {
  title: "Travel Guides & Itineraries | TravelPlanInfo",
  description: "Expert travel guides, itineraries, and tips for destinations worldwide. Plan your perfect trip with advice from experienced travelers.",
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function Guides({ params: _params }: Props) {
  const posts = getAllArticles();
  const t = await getTranslations("guides");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="w-full px-6 lg:px-12 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-teal-800 font-medium mb-4">
            {t("title")}
          </p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t("heading")}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t("subheading")}
          </p>
        </div>

        <GuidesFilter posts={posts} />

        {/* Newsletter */}
        <div className="mt-16 bg-teal-800 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            {t("newsletterTitle")}
          </h2>
          <p className="text-teal-100 mb-6 max-w-xl mx-auto">
            {t("newsletterSubtitle")}
          </p>
          <NewsletterForm source="guides" />
          <p className="text-xs text-teal-300 mt-3">{t("noSpam")}</p>
        </div>
      </main>
      <HelpButton pageId="guides" />
    </div>
  );
}
