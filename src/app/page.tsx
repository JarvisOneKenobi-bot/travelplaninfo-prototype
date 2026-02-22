import HeroCarousel from "@/components/HeroCarousel";
import SidebarAds from "@/components/SidebarAds";

const quickDeals = [
  {
    title: "Fort Lauderdale to Miami Beach Shuttle",
    price: "$39",
    note: "Instant confirmation",
  },
  {
    title: "Everglades Airboat + Wildlife Park",
    price: "$72",
    note: "Family favorite",
  },
  {
    title: "South Beach Art Deco Walking Tour",
    price: "$22",
    note: "Small groups",
  },
];

const guides = [
  "48-hour Miami itinerary (design district + Wynwood)",
  "What to pack for Miami in spring",
  "Top 8 beaches within 30 minutes of FLL",
  "Miami on a budget: food, transit, stays",
];

export default function Home() {
  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">TPI</span>
          <div>
            <p className="brandName">TravelPlanInfo</p>
            <p className="brandTag">Miami flight + stay deals, curated daily</p>
          </div>
        </div>
        <nav className="nav">
          <a>Flights</a>
          <a>Hotels</a>
          <a>Things to Do</a>
          <a>Guides</a>
        </nav>
        <button className="cta">Build My Miami Trip</button>
      </header>

      <section className="hero">
        <div className="heroMain">
          <div className="heroIntro">
            <p className="eyebrow">Live deal feed • Miami/FLL</p>
            <h1>Sun-soaked Miami trips with flight + stay bundles from $99.</h1>
            <p className="subhead">
              Compare Miami flight deals, beachfront stays, and curated itineraries. Updated
              hourly with affiliate offers.
            </p>
            <div className="heroActions">
              <button className="primary">View Today&apos;s Deals</button>
              <button className="ghost">See 3-day itinerary</button>
            </div>
            <div className="dealRibbon">
              <div>
                <span className="dealLabel">Flights</span>
                <strong>Miami (FLL) from $99</strong>
              </div>
              <div>
                <span className="dealLabel">Hotels</span>
                <strong>Beachfront from $79/night</strong>
              </div>
              <div>
                <span className="dealLabel">Bundle</span>
                <strong>2-night trip from $239</strong>
              </div>
            </div>
          </div>
          <HeroCarousel />
        </div>
        <SidebarAds />
      </section>

      <section className="contentGrid">
        <div className="card">
          <h2>Quick bookables</h2>
          <ul className="list">
            {quickDeals.map((deal) => (
              <li key={deal.title}>
                <div>
                  <p className="listTitle">{deal.title}</p>
                  <p className="listNote">{deal.note}</p>
                </div>
                <span className="pill">{deal.price}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Miami planning guides</h2>
          <ul className="guides">
            {guides.map((guide) => (
              <li key={guide}>{guide}</li>
            ))}
          </ul>
        </div>
        <div className="card dark">
          <h2>Deal alert</h2>
          <p>
            Join 41,200 travelers. We send weekly Miami flight + hotel bundles with
            price-drop alerts.
          </p>
          <div className="inputRow">
            <input placeholder="you@email.com" />
            <button>Notify me</button>
          </div>
          <p className="finePrint">No spam. Unsubscribe anytime.</p>
        </div>
      </section>
    </div>
  );
}
