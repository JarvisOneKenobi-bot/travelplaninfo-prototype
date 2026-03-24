"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Header from "@/components/Header";
import { CJ_LINKS, TP_CONFIG } from "@/config/affiliates";
const carsUrl = CJ_LINKS.cars();

const destinations = [
  {
    slug: "miami",
    name: "Miami",
    iata: "MIA",
    country: "USA",
    region: "Florida",
    image: "https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=800&q=80",
    flightsFrom: "From $99",
    hotelsFrom: "From $79/night",
    description: "Beaches, nightlife, and world-class dining"
  },
  {
    slug: "new-york",
    name: "New York City",
    iata: "JFK",
    country: "USA",
    region: "Northeast",
    image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80",
    flightsFrom: "From $129",
    hotelsFrom: "From $149/night",
    description: "The city that never sleeps"
  },
  {
    slug: "los-angeles",
    name: "Los Angeles",
    iata: "LAX",
    country: "USA",
    region: "California",
    image: "https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=800&q=80",
    flightsFrom: "From $119",
    hotelsFrom: "From $99/night",
    description: "Hollywood, beaches, and endless sunshine"
  },
  {
    slug: "chicago",
    name: "Chicago",
    iata: "ORD",
    country: "USA",
    region: "Midwest",
    image: "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=800&q=80",
    flightsFrom: "From $89",
    hotelsFrom: "From $89/night",
    description: "Architecture, deep-dish pizza, and Lake Michigan"
  },
  {
    slug: "las-vegas",
    name: "Las Vegas",
    iata: "LAS",
    country: "USA",
    region: "Nevada",
    image: "https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?w=800&q=80",
    flightsFrom: "From $79",
    hotelsFrom: "From $49/night",
    description: "Entertainment capital of the world"
  },
  {
    slug: "orlando",
    name: "Orlando",
    iata: "MCO",
    country: "USA",
    region: "Florida",
    image: "https://images.unsplash.com/photo-1596386461350-326ea777d85f?w=800&q=80",
    flightsFrom: "From $99",
    hotelsFrom: "From $85/night",
    description: "Theme parks and family fun"
  },
  {
    slug: "fort-lauderdale",
    name: "Fort Lauderdale",
    iata: "FLL",
    country: "USA",
    region: "Florida",
    image: "https://images.unsplash.com/photo-1560269983-3c767e1a4a5b?w=800&q=80",
    flightsFrom: "From $89",
    hotelsFrom: "From $75/night",
    description: "Beaches and boating paradise"
  },
  {
    slug: "key-west",
    name: "Key West",
    iata: "EYW",
    country: "USA",
    region: "Florida",
    image: "https://images.unsplash.com/photo-1580978955498-a1c5aa72b9b0?w=800&q=80",
    flightsFrom: "From $129",
    hotelsFrom: "From $119/night",
    description: "Tropical paradise at the end of the road"
  },
  {
    slug: "jamaica",
    name: "Jamaica",
    iata: "MBJ",
    country: "Caribbean",
    region: "Caribbean",
    image: "https://images.unsplash.com/photo-1552353617-3bfd679b3bdd?w=800&q=80",
    flightsFrom: "From $249",
    hotelsFrom: "From $150/night",
    description: "Reggae, rum, and beaches"
  },
  {
    slug: "bahamas",
    name: "Bahamas",
    iata: "NAS",
    country: "Caribbean",
    region: "Caribbean",
    image: "https://images.unsplash.com/photo-1597423244039-d4f591d7b6a9?w=800&q=80",
    flightsFrom: "From $199",
    hotelsFrom: "From $130/night",
    description: "Crystal clear waters and private islands"
  },
  {
    slug: "punta-cana",
    name: "Punta Cana",
    iata: "PUJ",
    country: "Dominican Republic",
    region: "Caribbean",
    image: "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?w=800&q=80",
    flightsFrom: "From $229",
    hotelsFrom: "From $110/night",
    description: "All-inclusive resorts and pristine beaches"
  },
  {
    slug: "cancun",
    name: "Cancún",
    iata: "CUN",
    country: "Mexico",
    region: "Mexico",
    image: "https://images.unsplash.com/photo-1552074291-ad4dfd8b11c0?w=800&q=80",
    flightsFrom: "From $179",
    hotelsFrom: "From $90/night",
    description: "Mayan ruins and Caribbean waters"
  }
];

export default function Destinations() {
  const t = useTranslations("destinations");
  const [query, setQuery] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const filtered = submitted && query.trim()
    ? destinations.filter(dest => {
        const q = query.toLowerCase();
        return (
          dest.name.toLowerCase().includes(q) ||
          dest.country.toLowerCase().includes(q) ||
          dest.region.toLowerCase().includes(q) ||
          dest.description.toLowerCase().includes(q)
        );
      })
    : destinations;

  function flightUrl(dest: typeof destinations[0]) {
    return TP_CONFIG.searchUrl("JFK", dest.iata);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  function handleClear() {
    setQuery("");
    setCheckin("");
    setCheckout("");
    setSubmitted(false);
  }

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

        {/* Search Box */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-12">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <input
              type="date"
              value={checkin}
              onChange={e => setCheckin(e.target.value)}
              className="px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <input
              type="date"
              value={checkout}
              onChange={e => setCheckout(e.target.value)}
              className="px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="bg-teal-700 text-white px-8 py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors"
            >
              {t("searchButton")}
            </button>
            {submitted && (
              <button
                type="button"
                onClick={handleClear}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {t("clearButton")}
              </button>
            )}
          </form>
        </div>

        {/* Destinations Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg text-gray-600 mb-4">
              {t("noDestinationsFound")} &ldquo;{query}&rdquo;. {t("tryDifferentSearch")}
            </p>
            <button
              onClick={handleClear}
              className="bg-teal-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors"
            >
              {t("showAllDestinations")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((dest) => (
              <div
                key={dest.slug}
                id={dest.slug}
                className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="h-48 overflow-hidden relative">
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-gray-700">
                    {dest.country}
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{dest.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{dest.description}</p>

                  <div className="flex gap-3 mb-4">
                    <div className="bg-orange-50 px-3 py-1.5 rounded-lg">
                      <p className="text-xs text-orange-600 font-medium">✈️ {dest.flightsFrom}</p>
                    </div>
                    <div className="bg-teal-50 px-3 py-1.5 rounded-lg">
                      <p className="text-xs text-teal-700 font-medium">🏨 {dest.hotelsFrom}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-2">
                    <a
                      href={flightUrl(dest)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center bg-orange-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      {t("findFlights")}
                    </a>
                    <a
                      href={CJ_LINKS.hotelsCity(dest.name)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="flex-1 text-center border border-teal-600 text-teal-700 text-sm font-medium py-2.5 rounded-lg hover:bg-teal-50 transition-colors"
                    >
                      {t("findHotels")}
                    </a>
                  </div>
                  <a
                    href={carsUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="block w-full text-center border border-emerald-600 text-emerald-700 text-sm font-medium py-2 rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    {t("rentACar")}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-16 bg-teal-800 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            {t("dontSeeDestination")}
          </h2>
          <p className="text-teal-100 mb-6 max-w-xl mx-auto">
            {t("dontSeeDesc")}
          </p>
          <div className="flex justify-center gap-4">
            <a
              href={`https://www.aviasales.com/?marker=${TP_CONFIG.marker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors inline-block"
            >
              {t("searchAllFlights")}
            </a>
            <a
              href={CJ_LINKS.hotels()}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="bg-white text-teal-800 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-block"
            >
              {t("searchAllHotels")}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
