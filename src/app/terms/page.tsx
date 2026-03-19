import type { Metadata } from "next";
import Header from "@/components/Header";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | TravelPlanInfo",
  description: "Read TravelPlanInfo's terms of service, including our affiliate disclosure, content policy, and user responsibilities.",
};

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">1. Use of Site</h2>
            <p className="text-gray-700">
              TravelPlanInfo provides travel information, guides, and curated affiliate deals for informational purposes. By using this site, you agree to use it lawfully and not to reproduce or redistribute our content without permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">2. Affiliate Disclosure</h2>
            <p className="text-gray-700">
              This site participates in affiliate marketing programs. When you click certain links and make a purchase, TravelPlanInfo may earn a commission at no additional cost to you. We only partner with brands we trust. Our editorial opinions are not influenced by affiliate relationships.
            </p>
            <p className="text-gray-700 mt-2">
              Affiliate programs include: CJ Affiliate (Hotels.com, Vrbo, CruiseDirect), and Travelpayouts (Aviasales).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">3. Accuracy of Information</h2>
            <p className="text-gray-700">
              Travel prices, availability, and conditions change frequently. Always verify details directly with the booking provider before purchasing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">4. Limitation of Liability</h2>
            <p className="text-gray-700">
              TravelPlanInfo is not liable for any losses arising from your use of this site, including travel disruptions, booking errors, or changes in third-party offers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">5. Contact</h2>
            <p className="text-gray-700">
              Questions? See our <Link href="/privacy" className="text-teal-700 hover:underline">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
