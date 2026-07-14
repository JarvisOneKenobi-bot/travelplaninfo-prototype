import { expect, type Page, test } from '@playwright/test';
import { CJ_BANNERS, CJ_LINKS, DEALS, TP_CONFIG, getAffiliateUrl } from '../../src/config/affiliates';

const cjDomain = /^(https:\/\/)?(www\.)?(dpbolvw\.net|jdoqocy\.com|tkqlhce\.com|anrdoezrs\.net|kqzyfj\.com)\//i;
const cjOrTpTrackingDomain = /^(https:\/\/)?(www\.)?(dpbolvw\.net|jdoqocy\.com|tkqlhce\.com|anrdoezrs\.net|kqzyfj\.com|aviasales\.com)\//i;

const fabricatedClaimPatterns = [
  { label: 'price shape', regex: /\$\s?\d/g },
  { label: 'unit pricing', regex: /\/night|\/day|\/person/gi },
  { label: 'live deal feed', regex: /live\s*deal\s*feed/gi },
  { label: 'tonight', regex: /tonight/gi },
  { label: 'late-night', regex: /late[-\s]?night/gi },
  { label: 'last-minute', regex: /last[-\s]?minute/gi },
  { label: 'limited inventory', regex: /limited inventory/gi },
  { label: 'percent off', regex: /\d+\s*%\s*off/gi },
  { label: 'percent savings', regex: /save\s+(up\s+to\s+)?\d+\s*%/gi },
  { label: 'fabricated duration', regex: /\b\d+[-\s]nights?\b/gi },
];

const priceShapePatterns = fabricatedClaimPatterns.slice(0, 2);

function collectFabricatedClaimMatches(text: string): string[] {
  return fabricatedClaimPatterns.flatMap(({ label, regex }) => {
    regex.lastIndex = 0;
    return Array.from(text.matchAll(regex), (match) => `${label}: "${match[0]}"`);
  });
}

function collectPriceShapeMatches(text: string): string[] {
  return priceShapePatterns.flatMap(({ label, regex }) => {
    regex.lastIndex = 0;
    return Array.from(text.matchAll(regex), (match) => `${label}: "${match[0]}"`);
  });
}

async function pageHrefs(page: Page): Promise<string[]> {
  return page.locator('a[href]').evaluateAll((anchors) =>
    anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
  );
}

function expectNoFabricatedClaims(route: string, bodyText: string) {
  const matches = collectFabricatedClaimMatches(bodyText);
  expect(matches, `Fabricated claims rendered on ${route}:\n${matches.join('\n')}`).toEqual([]);
}

async function expectNoPriceShapes(locator: ReturnType<Page['locator']>, label: string) {
  const text = await locator.innerText();
  const matches = collectPriceShapeMatches(text);
  expect(matches, `Price-shaped claims rendered in ${label}:\n${matches.join('\n')}`).toEqual([]);
}

function escapeRegex(text: string): string {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

const destinations = [
  { slug: 'miami', name: 'Miami', iata: 'MIA' },
  { slug: 'new-york', name: 'New York City', iata: 'JFK' },
  { slug: 'los-angeles', name: 'Los Angeles', iata: 'LAX' },
  { slug: 'chicago', name: 'Chicago', iata: 'ORD' },
  { slug: 'las-vegas', name: 'Las Vegas', iata: 'LAS' },
  { slug: 'orlando', name: 'Orlando', iata: 'MCO' },
  { slug: 'fort-lauderdale', name: 'Fort Lauderdale', iata: 'FLL' },
  { slug: 'key-west', name: 'Key West', iata: 'EYW' },
  { slug: 'jamaica', name: 'Jamaica', iata: 'MBJ' },
  { slug: 'bahamas', name: 'Bahamas', iata: 'NAS' },
  { slug: 'punta-cana', name: 'Punta Cana', iata: 'PUJ' },
  { slug: 'cancun', name: 'Cancún', iata: 'CUN' },
];

test.describe('no fabricated claims in rendered travel commerce pages', () => {
  for (const route of ['/en/hot-deals', '/en/destinations']) {
    test(`${route} renders no fabricated price, urgency, discount, or duration claims`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      const bodyText = await page.locator('body').innerText();

      expectNoFabricatedClaims(route, bodyText);
    });
  }
});

test.describe('affiliate monetization survives fabricated-claim removal', () => {
  test('/en/hot-deals keeps specific CJ affiliate CTAs and deal links', async ({ page }) => {
    await page.goto('/en/hot-deals', { waitUntil: 'domcontentloaded' });

    const hrefs = await pageHrefs(page);

    const heroCtas = [
      { href: CJ_LINKS.hotels(), text: /^🏨 Hotels\.com Deals$/ },
      { href: CJ_LINKS.vrbo(), text: /^🏡 Vrbo Rentals$/ },
      { href: CJ_LINKS.cars(), text: /^🚗 Car Rentals$/ },
      { href: CJ_LINKS.cruises(), text: /^🚢 CruiseDirect$/ },
    ];
    for (const { href, text } of heroCtas) {
      expect(href, `hero CTA should use a CJ tracking domain: ${href}`).toMatch(cjDomain);
      await expect(page.locator(`a[href="${href}"]`).filter({ hasText: text })).toHaveCount(1);
    }

    await expect(page.locator(`a[href="${CJ_LINKS.cruises()}"]`).filter({ hasText: 'View on CruiseDirect' })).toHaveCount(1);
    await expect(page.getByText('View on CruiseDirect')).toBeVisible();

    const programCards = [
      { href: CJ_LINKS.hotels(), text: /Miami Beach hotels/ },
      { href: CJ_LINKS.vrbo(), text: /Entire home rentals/ },
      { href: CJ_LINKS.cruisesLastMinute(), text: /Cruise deals/ },
      { href: CJ_LINKS.cars(), text: /Car rentals — all brands compared/ },
    ];
    for (const { href, text } of programCards) {
      expect(href, `program card should use a CJ tracking domain: ${href}`).toMatch(cjDomain);
      await expect(page.locator(`a[href="${href}"]`).filter({ hasText: text })).toHaveCount(1);
    }

    for (const deal of DEALS) {
      const href = getAffiliateUrl(deal);
      expect(href, `${deal.id} should resolve to a CJ tracking domain`).toMatch(cjDomain);
      await expect(page.locator(`a[href="${href}"]`).filter({ hasText: new RegExp(`${escapeRegex(deal.cta)}\\s*→`) })).toHaveCount(1);
      expect(hrefs, `${deal.id} (${deal.cta}) exact href missing: ${href}`).toContain(href);
    }

    const cjAnchorCount = hrefs.filter((href) => cjDomain.test(href)).length;
    // Current /en/hot-deals renders 25 CJ anchors: 4 hero CTAs, 1 featured CruiseDirect card,
    // 8 compact deal links, 4 program cards, and 8 all-deals card links. Keep this floor so
    // the rendered monetization surface cannot silently shrink while specific href checks stay green.
    expect(cjAnchorCount).toBeGreaterThanOrEqual(25);
  });

  test('/en/destinations keeps each destination flight, hotel, and car-rental affiliate CTA', async ({ page }) => {
    await page.goto('/en/destinations', { waitUntil: 'domcontentloaded' });

    const hrefs = await pageHrefs(page);
    const carHref = CJ_LINKS.cars();

    for (const destination of destinations) {
      const card = page.locator(`#${destination.slug}`);
      const flightHref = TP_CONFIG.searchUrl('JFK', destination.iata);
      const hotelsHref = CJ_LINKS.hotelsCity(destination.name);

      await expect(card.locator(`a[href="${flightHref}"]`), `${destination.name} flight-search CTA missing`).toHaveCount(1);
      await expect(card.locator(`a[href="${hotelsHref}"]`), `${destination.name} Hotels.com CJ CTA missing`).toHaveCount(1);
      await expect(card.locator(`a[href="${carHref}"]`), `${destination.name} car-rental CJ CTA missing`).toHaveCount(1);

      expect(flightHref, `${destination.name} flight CTA should use Aviasales marker tracking`).toContain(`marker=${TP_CONFIG.marker}`);
      expect(hotelsHref, `${destination.name} hotel CTA should use a CJ tracking domain`).toMatch(cjDomain);
      expect(carHref, `${destination.name} car CTA should use a CJ tracking domain`).toMatch(cjDomain);
    }

    const trackingAnchorCount = hrefs.filter((href) => cjOrTpTrackingDomain.test(href)).length;
    // Current /en/destinations renders 38 CJ/TravelPayouts tracking anchors:
    // 12 cards × 3 CTAs plus the 2 bottom "search all" CTAs.
    expect(trackingAnchorCount).toBeGreaterThanOrEqual(38);
  });

  test('/en/travel-planning-guide keeps article affiliate widgets monetized without component prices', async ({ page }) => {
    await page.goto('/en/travel-planning-guide', { waitUntil: 'domcontentloaded' });

    const inlineCta = page.locator('div.my-8').filter({ hasText: 'Ready to book your trip?' });
    await expect(inlineCta).toHaveCount(1);

    const inlineLinks = [
      { href: CJ_LINKS.hotels(), text: /Find Hotels/ },
      { href: CJ_LINKS.vrbo(), text: /Vacation Rentals/ },
      { href: CJ_LINKS.cruises(), text: /Cruise Deals/ },
    ];
    for (const { href, text } of inlineLinks) {
      expect(href, `article inline CTA should use a CJ tracking domain: ${href}`).toMatch(cjDomain);
      await expect(inlineCta.locator(`a[href="${href}"]`).filter({ hasText: text })).toHaveCount(1);
    }
    await expect(inlineCta.locator('a[href]')).toHaveCount(3);

    const sidebar = page.locator('aside').filter({ hasText: 'Travel Deals' });
    await expect(sidebar).toHaveCount(1);

    for (const deal of DEALS.slice(0, 3)) {
      const href = getAffiliateUrl(deal);
      expect(href, `${deal.id} article sidebar deal should resolve to a CJ tracking domain`).toMatch(cjDomain);
      await expect(sidebar.locator(`a[href="${href}"]`).filter({ hasText: new RegExp(`${escapeRegex(deal.cta)}\\s*→`) })).toHaveCount(1);
    }

    for (const banner of CJ_BANNERS) {
      expect(banner.url, `${banner.id} article sidebar banner should use a CJ tracking domain`).toMatch(cjDomain);
      await expect(sidebar.locator(`a[aria-label="${banner.advertiser} — ${banner.headline}"][href="${banner.url}"]`)).toHaveCount(1);
    }

    await expect(sidebar.locator('a[href]')).toHaveCount(DEALS.slice(0, 3).length + CJ_BANNERS.length);

    await expectNoPriceShapes(inlineCta, 'article AffiliateInlineCTA');
    await expectNoPriceShapes(sidebar, 'article AffiliateSidebar');
  });
});
