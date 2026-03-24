import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Header from "@/components/Header";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | TravelPlanInfo",
  description: "TravelPlanInfo's privacy policy — how we collect, use, and protect your personal information.",
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function Privacy({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">1. Information We Collect</h2>
            <p className="text-gray-700">
              We may collect email addresses (newsletters) and non-personally identifiable information via analytics tools.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">2. How We Use Your Information</h2>
            <p className="text-gray-700">
              Email addresses are used only to send travel deals and updates. We do not sell your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">3. Cookies &amp; Analytics</h2>
            <p className="text-gray-700">
              This site uses analytics to understand how visitors use the site. These tools may use cookies. You can opt out via your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">4. Third-Party Links</h2>
            <p className="text-gray-700">
              Our site links to third-party sites (Hotels.com, Vrbo, CruiseDirect, Aviasales, etc.). We are not responsible for their privacy practices.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">5. Your Rights</h2>
            <p className="text-gray-700">
              You may request deletion of personal data we hold. Newsletter subscribers can unsubscribe at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">6. Contact</h2>
            <p className="text-gray-700">
              Questions? See our <Link href="/terms" className="text-teal-700 hover:underline">Terms of Service</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
