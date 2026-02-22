const ads = [
  {
    title: "Adsense",
    headline: "Late-night hotel deals",
    body: "Up to 45% off Miami Beach stays tonight.",
    cta: "View rates",
  },
  {
    title: "Adsense",
    headline: "FLL rides from $24",
    body: "Airport pickups + Miami Beach drop-off.",
    cta: "Book a ride",
  },
  {
    title: "Adsense",
    headline: "Cuban food tour",
    body: "Little Havana bites + mojito class.",
    cta: "Reserve spot",
  },
];

export default function SidebarAds() {
  return (
    <aside className="sidebar">
      <div className="sidebarHeader">
        <p>Sponsored</p>
        <span>Adsense sidebar</span>
      </div>
      {ads.map((ad) => (
        <div key={ad.headline} className="adCard">
          <span className="adLabel">{ad.title}</span>
          <h4>{ad.headline}</h4>
          <p>{ad.body}</p>
          <button>{ad.cta}</button>
        </div>
      ))}
    </aside>
  );
}
