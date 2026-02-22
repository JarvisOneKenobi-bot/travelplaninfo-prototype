export const site = {
  name: "TravelPlanInfo",
  description: "Your guide to planning trips — deals, itineraries, and destination insights.",
  url: "https://travelplaninfo.com",
};

export function makeMetadata({
  title,
  description,
  path,
  image,
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
}) {
  const fullTitle = title ? `${title} | ${site.name}` : site.name;
  const fullDesc = description || site.description;
  const fullUrl = path ? `${site.url}${path}` : site.url;
  const fullImage = image || `${site.url}/og-image.png`;

  return {
    title: fullTitle,
    description: fullDesc,
    openGraph: {
      title: fullTitle,
      description: fullDesc,
      url: fullUrl,
      siteName: site.name,
      images: [{ url: fullImage }],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: fullDesc,
      images: [fullImage],
    },
    alternates: {
      canonical: fullUrl,
    },
  };
}
