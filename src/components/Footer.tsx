import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function Footer() {
  const year = new Date().getFullYear();
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="w-full px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <p className="text-white font-bold text-lg mb-2">TravelPlanInfo</p>
            <p className="text-sm text-gray-400">
              {t("tagline")}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-widest">{t("explore")}</p>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href="/" className="hover:text-white transition-colors">{tNav("home")}</Link>
              <Link href="/destinations" className="hover:text-white transition-colors">{tNav("destinations")}</Link>
              <Link href="/hot-deals" className="hover:text-white transition-colors">{tNav("hotDeals")}</Link>
              <Link href="/planner" className="hover:text-white transition-colors">{t("tripPlanner")}</Link>
              <Link href="/guides" className="hover:text-white transition-colors">{t("travelGuides")}</Link>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-widest">{t("legal")}</p>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">{t("privacyPolicy")}</Link>
              <Link href="/terms" className="hover:text-white transition-colors">{t("termsOfService")}</Link>
            </nav>
          </div>
        </div>

        {/* Affiliate disclosure */}
        <div className="border-t border-gray-700 pt-6 space-y-2">
          <p className="text-xs text-gray-500">
            <strong className="text-gray-400">{t("affiliateDisclosure")}</strong> {t("affiliateDisclosureText")}
          </p>
          <p className="text-xs text-gray-600">
            © {year} TravelPlanInfo. {t("allRightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
}
