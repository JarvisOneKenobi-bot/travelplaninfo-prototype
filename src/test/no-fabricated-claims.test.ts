import fs from "node:fs";
import path from "node:path";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import ts from "typescript";
import AffiliateSidebar from "@/components/AffiliateSidebar";
import { CJ_BANNERS, CJ_LINKS, DEALS, getAffiliateUrl } from "@/config/affiliates";

const ROOT = process.cwd();
const CJ_DOMAIN = /^https:\/\/(?:www\.)?(?:dpbolvw\.net|jdoqocy\.com|tkqlhce\.com|anrdoezrs\.net|kqzyfj\.com)\//;
const PRICE_PATTERNS = [/\$\s?\d/, /\/night|\/day|\/person/i];
const URGENCY_PATTERNS = [
  /live\s*deal\s*feed/i,
  /tonight/i,
  /late[-\s]?night/i,
  /last[-\s]?minute/i,
  /limited inventory/i,
  /\d+\s*%\s*off/i,
  /save\s+(up\s+to\s+)?\d+\s*%/i,
  /weekly discounts/i,
  /\b\d+[-\s]nights?\b/i,
  /gu?aran/i,
];
const MULTILINGUAL_FABRICATED_CLAIM_PATTERNS = [
  /\d+\s*%/,
  /descuento|desconto|sconto|rabatt|réduction|ermäßigung/i,
  /last[-\s]?minute/i,
  /último minuto/i,
  /última hora/i,
  /dernière minute/i,
  /ultimo minuto/i,
  /tonight/i,
  /esta noche/i,
  /hoje à noite/i,
  /ce soir/i,
  /heute abend/i,
  /stasera/i,
  /limited (?:inventory|time)/i,
  /disponibilidad limitada/i,
  /plazas limitadas/i,
  /disponibilidade limitada/i,
  /places limitées/i,
  /begrenzte verfügbarkeit/i,
  /disponibilit[àa] limitad[ao]/i,
  /gu?aran/i,
];
const I18N_PATTERNS = [
  ...PRICE_PATTERNS,
  /\blive\b/i,
  /\bfeed\b/i,
  /\bflux\b/i,
  ...MULTILINGUAL_FABRICATED_CLAIM_PATTERNS,
];
// Keep price-shaped i18n checks dollar/night/day/person scoped. affiliateRecommendations.airAdvisorDesc
// includes EU261's real, regulation-backed €600 compensation cap, so euro/pound literals are not
// fabricated-price signals in this namespace.
const AFFILIATE_RECOMMENDATIONS_PATTERNS = [
  ...PRICE_PATTERNS,
  ...MULTILINGUAL_FABRICATED_CLAIM_PATTERNS,
  /hurry/i,
  /\bdeals?\b/i,
  /\bofertas?\b/i,
  /\boffres?\b/i,
  /\bangebote?\b/i,
  /\bofferte?\b/i,
];
// Deliberately do not reuse I18N_PATTERNS here: its /\blive\b/, /\bfeed\b/,
// and /\bflux\b/ checks are hotDeals "live deal feed" specific, while "flux"
// is ordinary French (for example, "flux touristique") in destinations copy.
const DESTINATIONS_I18N_PATTERNS = [...PRICE_PATTERNS, ...MULTILINGUAL_FABRICATED_CLAIM_PATTERNS];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  const normalized = normalizeMatchedText(text);
  return patterns.some((pattern) => pattern.test(normalized));
}

function isApprovedPartnerProgramClaim(text: string): boolean {
  return APPROVED_PARTNER_PROGRAM_CLAIMS.has(normalizeMatchedText(text));
}

const SOURCE_FILES = [
  "src/app/[locale]/destinations/page.tsx",
  "src/app/[locale]/hot-deals/page.tsx",
  "src/config/affiliates.ts",
  "src/components/ArticleAffiliateCTA.tsx",
  "src/components/AffiliateInlineCTA.tsx",
] as const;

const URGENCY_SOURCE_FILES = [
  "src/app/[locale]/destinations/page.tsx",
  "src/app/[locale]/hot-deals/page.tsx",
  "src/components/ArticleAffiliateCTA.tsx",
  "src/components/AffiliateInlineCTA.tsx",
] as const;

const LOCALES = ["de", "en", "es", "fr", "it", "pt"] as const;

// This manifest is intentionally hardcoded: this key has already carried a fabricated discount
// claim once; a regex cannot distinguish an honest sentence from a fabricated one, so any future
// edit to this copy must be a deliberate, reviewed change to this manifest.
const APPROVED_CRUISES_DESC: Record<(typeof LOCALES)[number], string> = {
  en: "Search and compare CruiseDirect sailings across major cruise lines.",
  es: "Busca y compara salidas de las principales navieras en CruiseDirect.",
  pt: "Pesquise e compare cruzeiros das principais companhias de cruzeiro no CruiseDirect.",
  fr: "Recherchez et comparez les départs des grandes compagnies de croisière sur CruiseDirect.",
  de: "Suchen und vergleichen Sie auf CruiseDirect Kreuzfahrten großer Reedereien.",
  it: "Cerca e confronta su CruiseDirect le partenze delle principali compagnie di crociera.",
};

// These are byte-exact normalized whole-string exemptions for pre-existing, reviewed
// partner-program claims. Hotels.com Price Match Guarantee and EconomyBookings' best-price
// guarantee are the partners' own advertised programs, deferred to a future copy sweep.
// Any new guarantee claim is a violation; near-misses must not be substring-exempted.
const APPROVED_PARTNER_PROGRAM_CLAIMS = new Set([
  "500+ suppliers. Best price guarantee. Free cancellation.",
  "Top-rated hotels with free cancellation. Best price guaranteed.",
  "Hand-picked 4★ & 5★ hotels. Hotels.com Price Match Guarantee.",
  "Hoteles 4★ y 5★ seleccionados. Garantía de igualación de precios.",
  "Hotéis 4★ e 5★ selecionados. Garantia de igualdade de preços.",
  "Hôtels 4★ et 5★ sélectionnés. Garantie d alignement des prix.",
  "Ausgewählte 4★ & 5★ Hotels. Preisgarantie.",
  "Hotel 4★ e 5★ selezionati. Garanzia di corrispondenza prezzi.",
]);

type Violation = {
  file: string;
  line: number;
  text: string;
};

function readRepoFile(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function parseTsx(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readRepoFile(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function normalizeMatchedText(text: string): string {
  return text
    .replace(/^[^\p{L}\p{N}$]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lineFor(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function addTextViolation(
  violations: Violation[],
  sourceFile: ts.SourceFile,
  file: string,
  node: ts.Node,
  text: string,
  patterns: RegExp[],
): void {
  const normalized = normalizeMatchedText(text);
  if (!normalized) return;
  if (isApprovedPartnerProgramClaim(normalized)) return;
  if (patterns.some((pattern) => pattern.test(normalized))) {
    violations.push({ file, line: lineFor(sourceFile, node), text: normalized });
  }
}

function isTextNode(node: ts.Node): node is
  | ts.StringLiteral
  | ts.NoSubstitutionTemplateLiteral
  | ts.TemplateHead
  | ts.TemplateMiddle
  | ts.TemplateTail
  | ts.JsxText {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node) ||
    ts.isJsxText(node)
  );
}

function stringLiteralText(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function hasDollarEndingStringPlusNumber(node: ts.BinaryExpression): boolean {
  if (node.operatorToken.kind !== ts.SyntaxKind.PlusToken) return false;

  const leftText = stringLiteralText(node.left);
  const rightText = stringLiteralText(node.right);

  return (
    (leftText !== null && /\$\s*$/.test(leftText) && ts.isNumericLiteral(node.right)) ||
    (rightText !== null && /\$\s*$/.test(rightText) && ts.isNumericLiteral(node.left))
  );
}

function hasDollarTemplateExpression(node: ts.TemplateExpression): boolean {
  return node.templateSpans.some((span, index) => {
    const priorText = index === 0 ? node.head.text : node.templateSpans[index - 1].literal.text;
    return /\$\s*$/.test(priorText) && ts.isNumericLiteral(span.expression);
  });
}

function collectTextViolations(file: string, patterns: RegExp[], rootNode?: ts.Node): Violation[] {
  const sourceFile = parseTsx(file);
  const violations: Violation[] = [];
  const startNode = rootNode ?? sourceFile;

  function visit(node: ts.Node): void {
    if (isTextNode(node)) {
      addTextViolation(violations, sourceFile, file, node, node.text, patterns);
    }
    ts.forEachChild(node, visit);
  }

  visit(startNode);
  return violations;
}

function collectPriceViolations(file: string): Violation[] {
  const sourceFile = parseTsx(file);
  const violations: Violation[] = [];

  function visit(node: ts.Node): void {
    if (isTextNode(node)) {
      addTextViolation(violations, sourceFile, file, node, node.text, PRICE_PATTERNS);
    }

    if (ts.isJsxExpression(node) && node.expression && ts.isNumericLiteral(node.expression)) {
      violations.push({ file, line: lineFor(sourceFile, node), text: node.expression.text });
    }

    if (ts.isBinaryExpression(node) && hasDollarEndingStringPlusNumber(node)) {
      violations.push({ file, line: lineFor(sourceFile, node), text: normalizeMatchedText(node.getText(sourceFile)) });
    }

    if (ts.isTemplateExpression(node) && hasDollarTemplateExpression(node)) {
      violations.push({ file, line: lineFor(sourceFile, node), text: normalizeMatchedText(node.getText(sourceFile)) });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function findDealsVariableStatement(sourceFile: ts.SourceFile): ts.VariableStatement {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const hasDealsDeclaration = statement.declarationList.declarations.some((declaration) =>
      ts.isIdentifier(declaration.name) && declaration.name.text === "DEALS",
    );
    if (hasDealsDeclaration) return statement;
  }
  throw new Error("Could not find DEALS variable statement in src/config/affiliates.ts");
}

function collectUrgencyViolations(): Violation[] {
  const violations = URGENCY_SOURCE_FILES.flatMap((file) => collectTextViolations(file, URGENCY_PATTERNS));
  const affiliatesFile = "src/config/affiliates.ts";
  const affiliatesSource = parseTsx(affiliatesFile);
  const dealsStatement = findDealsVariableStatement(affiliatesSource);

  return [
    ...violations,
    ...collectTextViolations(affiliatesFile, URGENCY_PATTERNS, dealsStatement),
  ];
}

function collectJsonStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectJsonStrings);
  return Object.values(value as Record<string, unknown>).flatMap(collectJsonStrings);
}

function collectI18nNamespaceViolations(
  namespace: string,
  patterns: RegExp[],
  approvedCopy: ReadonlySet<string> = APPROVED_PARTNER_PROGRAM_CLAIMS,
): Violation[] {
  const violations: Violation[] = [];

  for (const locale of LOCALES) {
    const file = `messages/${locale}/common.json`;
    const raw = readRepoFile(file);
    const json = JSON.parse(raw) as Record<string, unknown>;
    for (const text of collectJsonStrings(json[namespace])) {
      const normalized = normalizeMatchedText(text);
      if (approvedCopy.has(normalized)) continue;
      if (patterns.some((pattern) => pattern.test(normalized))) {
        const offset = raw.indexOf(JSON.stringify(text));
        const line = offset === -1 ? 1 : raw.slice(0, offset).split("\n").length;
        violations.push({ file, line, text: normalized });
      }
    }
  }

  return violations;
}

function collectI18nViolations(): Violation[] {
  return collectI18nNamespaceViolations("hotDeals", I18N_PATTERNS);
}

function affiliateRecommendationsCruisesDesc(locale: (typeof LOCALES)[number]): string | undefined {
  const json = JSON.parse(readRepoFile(`messages/${locale}/common.json`)) as {
    affiliateRecommendations?: { cruisesDesc?: unknown };
  };
  const cruisesDesc = json.affiliateRecommendations?.cruisesDesc;
  return typeof cruisesDesc === "string" ? cruisesDesc : undefined;
}

function affiliateRecommendationsLuxuryHotelsDesc(locale: (typeof LOCALES)[number]): string | undefined {
  const json = JSON.parse(readRepoFile(`messages/${locale}/common.json`)) as {
    affiliateRecommendations?: { luxuryHotelsDesc?: unknown };
  };
  const luxuryHotelsDesc = json.affiliateRecommendations?.luxuryHotelsDesc;
  return typeof luxuryHotelsDesc === "string" ? luxuryHotelsDesc : undefined;
}

function destinationsSubheading(locale: (typeof LOCALES)[number]): string | undefined {
  const json = JSON.parse(readRepoFile(`messages/${locale}/common.json`)) as {
    destinations?: { subheading?: unknown };
  };
  const subheading = json.destinations?.subheading;
  return typeof subheading === "string" ? subheading : undefined;
}

// Byte-exact normalized whole-string exemption. "garantir" here is the ordinary Portuguese
// verb "to ensure", not a guarantee claim; /gu?aran/i cannot tell them apart. The copy is a
// pending product decision and is not ours to change, so it is exempted explicitly and
// auditably rather than by weakening the pattern. HARDCODED ON PURPOSE: deriving this from the
// live file would auto-approve any future edit and silently disable the guard.
const APPROVED_INNOCENT_VERB_COPY = new Set([
  "Encontre os melhores voos e hotéis nos principais destinos. Comparamos preços nos principais sites de reservas para garantir a melhor oferta.",
]);

function formatViolations(title: string, violations: Violation[]): string {
  const lines = violations.map(({ file, line, text }) => `${file}:${line}: "${text}"`);
  return `${title} found ${violations.length} violation${violations.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
}

function expectNoViolations(title: string, violations: Violation[]): void {
  expect(violations, formatViolations(title, violations)).toHaveLength(0);
}

function expectCjUrl(url: string): void {
  expect(url).toBeTruthy();
  expect(url).toMatch(CJ_DOMAIN);
}

describe("no fabricated claims guard", () => {
  it("imports the TypeScript compiler API cleanly in vitest", () => {
    expect(ts.version).toBe("5.7.3");
    expect(ts.createSourceFile).toBeTypeOf("function");
  });

  it("Arm A: source files do not contain fabricated price shapes", () => {
    const violations = SOURCE_FILES.flatMap(collectPriceViolations);
    expectNoViolations("Arm A price shape guard", violations);
  });

  it("Arm B: source files do not contain invented urgency or offer copy", () => {
    const violations = collectUrgencyViolations();
    expectNoViolations("Arm B urgency guard", violations);
  });

  it("Arm C: hotDeals i18n namespace does not claim live feeds or fabricated prices", () => {
    const violations = collectI18nViolations();
    expectNoViolations("Arm C i18n guard", violations);
  });

  it("Arm E: affiliateRecommendations i18n namespace does not contain fabricated prices, discounts, or urgency", () => {
    const violations = collectI18nNamespaceViolations(
      "affiliateRecommendations",
      AFFILIATE_RECOMMENDATIONS_PATTERNS,
    );
    expectNoViolations("Arm E affiliateRecommendations i18n guard", violations);
  });

  it("Arm F: destinations i18n namespace does not contain fabricated prices, discounts, or guarantees", () => {
    const violations = collectI18nNamespaceViolations(
      "destinations",
      DESTINATIONS_I18N_PATTERNS,
      APPROVED_INNOCENT_VERB_COPY,
    );
    expectNoViolations("Arm F destinations i18n guard", violations);
  });

  it("Arm F: destinations source page is included in urgency source scanning", () => {
    expect(URGENCY_SOURCE_FILES).toContain("src/app/[locale]/destinations/page.tsx");
  });

  it("negative guard samples: hotDeals i18n detects the verifier's Spanish discount sneak string", () => {
    expect(matchesAny("75% de descuento", I18N_PATTERNS)).toBe(true);
  });

  it("negative guard samples: source urgency detects the verifier's guarantee sneak string", () => {
    expect(matchesAny("Lowest fares guaranteed.", URGENCY_PATTERNS)).toBe(true);
  });

  it("negative guard samples: source urgency detects the verifier's urgency discount sneak string", () => {
    expect(matchesAny("Book tonight — 50% off", URGENCY_PATTERNS)).toBe(true);
  });

  it("negative guard samples: destinations i18n detects the verifier's Spanish discount sneak string", () => {
    expect(matchesAny("50% de descuento", DESTINATIONS_I18N_PATTERNS)).toBe(true);
  });

  it("negative guard samples: guarantee pattern catches Italian garanzia", () => {
    expect(matchesAny("Garanzia di prezzo più basso", URGENCY_PATTERNS)).toBe(true);
  });

  it("negative guard samples: destinations i18n guarantee pattern catches Italian garanzia", () => {
    expect(matchesAny("Garanzia di prezzo più basso", DESTINATIONS_I18N_PATTERNS)).toBe(true);
    expect(matchesAny("Melhor preço garantido.", DESTINATIONS_I18N_PATTERNS)).toBe(true);
    expect(APPROVED_INNOCENT_VERB_COPY.has(normalizeMatchedText("Melhor preco garantido."))).toBe(false);
  });

  it("approved partner-program claim exemptions are exact whole-string matches", () => {
    expect(isApprovedPartnerProgramClaim("Best price guarantee. Always.")).toBe(false);
  });

  it("Arm F: destinations exemptions do not inherit partner-program guarantee strings", () => {
    const partnerGuarantee = "Top-rated hotels with free cancellation. Best price guaranteed.";

    expect(APPROVED_INNOCENT_VERB_COPY.has(normalizeMatchedText(partnerGuarantee))).toBe(false);
    expect(matchesAny(partnerGuarantee, DESTINATIONS_I18N_PATTERNS)).toBe(true);
  });

  it("approved partner-program claim exemption manifest stays in sync with the 8 reviewed strings", () => {
    const reviewedClaims = [
      "500+ suppliers. Best price guarantee. Free cancellation.",
      "Top-rated hotels with free cancellation. Best price guaranteed.",
      ...LOCALES.map((locale) => affiliateRecommendationsLuxuryHotelsDesc(locale)),
    ];

    expect(reviewedClaims).toHaveLength(APPROVED_PARTNER_PROGRAM_CLAIMS.size);
    for (const claim of reviewedClaims) {
      expect(claim).toBeDefined();
      expect(isApprovedPartnerProgramClaim(claim as string), `${claim} must stay approved byte-exact`).toBe(true);
    }
  });

  it("Arm F: the approved innocent-verb exemption still matches the live PT copy", () => {
    const ptSubheading = destinationsSubheading("pt");

    expect(ptSubheading).toBeDefined();
    expect(APPROVED_INNOCENT_VERB_COPY.size).toBe(1);
    expect(normalizeMatchedText(ptSubheading as string)).toBe(
      "Encontre os melhores voos e hotéis nos principais destinos. Comparamos preços nos principais sites de reservas para garantir a melhor oferta.",
    );
  });

  it("Arm F: destinations innocent-verb exemption is byte-exact and does not hide appended fabrications", () => {
    const ptSubheading = destinationsSubheading("pt");

    expect(ptSubheading, "messages/pt/common.json missing destinations.subheading").toBeDefined();
    const nearMiss = `${ptSubheading as string} Melhor preco garantido.`;
    expect(
      APPROVED_INNOCENT_VERB_COPY.has(normalizeMatchedText(nearMiss)),
    ).toBe(false);
    expect(matchesAny(nearMiss, DESTINATIONS_I18N_PATTERNS)).toBe(true);
  });

  it("Arm F: destinations namespace is traversed and only the approved-copy exemption suppresses the PT string", () => {
    const ptSubheading = destinationsSubheading("pt");
    const unexempted = collectI18nNamespaceViolations("destinations", DESTINATIONS_I18N_PATTERNS, new Set());

    expect(ptSubheading, "messages/pt/common.json missing destinations.subheading").toBeDefined();
    expect(unexempted.length).toBeGreaterThanOrEqual(1);
    expect(unexempted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "messages/pt/common.json",
          text: normalizeMatchedText(ptSubheading as string),
        }),
      ]),
    );
    expect(
      collectI18nNamespaceViolations(
        "destinations",
        DESTINATIONS_I18N_PATTERNS,
        APPROVED_INNOCENT_VERB_COPY,
      ),
    ).toHaveLength(0);
  });

  it("Arm E: cruisesDesc exists in every locale and non-English locales are translated", () => {
    const english = affiliateRecommendationsCruisesDesc("en");
    expect(english, "messages/en/common.json missing affiliateRecommendations.cruisesDesc").toBeDefined();

    for (const locale of LOCALES) {
      const value = affiliateRecommendationsCruisesDesc(locale);
      expect(
        value,
        `messages/${locale}/common.json missing affiliateRecommendations.cruisesDesc`,
      ).toBeDefined();
      if (locale !== "en") {
        expect(
          value,
          `messages/${locale}/common.json cruisesDesc must not be byte-identical to EN`,
        ).not.toBe(english);
      }
    }
  });

  it("Arm E: cruisesDesc matches the approved per-locale copy manifest", () => {
    for (const locale of LOCALES) {
      expect(
        affiliateRecommendationsCruisesDesc(locale),
        `messages/${locale}/common.json affiliateRecommendations.cruisesDesc must match approved copy`,
      ).toBe(APPROVED_CRUISES_DESC[locale]);
    }
  });

  it("Arm E: ArticleAffiliateCTA keeps the hardcoded English cruisesDesc aligned with approved copy", () => {
    expect(readRepoFile("src/components/ArticleAffiliateCTA.tsx")).toContain(APPROVED_CRUISES_DESC.en);
  });

  it("Arm D: affiliate monetization links stay intact", () => {
    const expectedDealIds = [
      "cars-cancun",
      "cars-miami",
      "cruisedirect-bahamas",
      "cruisedirect-caribbean",
      "hotels-cancun",
      "hotels-miami-beach",
      "vrbo-miami-condo",
      "vrbo-nyc-apartment",
    ];
    // This manifest is intentionally hardcoded instead of derived from CJ_LINKS:
    // a deal silently re-pointed at the wrong program, CTA, or advertiser URL must fail the build.
    const expectedDealContracts = new Map<
      string,
      {
        program: "hotels" | "vrbo" | "cars" | "cruises";
        cta: string;
        href: string;
      }
    >([
      ["hotels-miami-beach", { program: "hotels", cta: "Search Hotels", href: "https://www.dpbolvw.net/click-101692716-15734399?sid=travelplaninfo" }],
      ["vrbo-miami-condo", { program: "vrbo", cta: "Browse Rentals", href: "https://www.jdoqocy.com/click-101692716-10784831?sid=travelplaninfo" }],
      ["cars-miami", { program: "cars", cta: "Compare Cars", href: "https://www.jdoqocy.com/click-101692716-15586457" }],
      ["cruisedirect-caribbean", { program: "cruises", cta: "View Cruises", href: "https://www.kqzyfj.com/click-101692716-13096782" }],
      ["hotels-cancun", { program: "hotels", cta: "Book Resort", href: "https://www.dpbolvw.net/click-101692716-15734399?sid=travelplaninfo" }],
      ["cars-cancun", { program: "cars", cta: "Find Cars", href: "https://www.jdoqocy.com/click-101692716-15586457" }],
      ["vrbo-nyc-apartment", { program: "vrbo", cta: "Find Apartments", href: "https://www.jdoqocy.com/click-101692716-10784831?sid=travelplaninfo" }],
      ["cruisedirect-bahamas", { program: "cruises", cta: "Escape to Bahamas", href: "https://www.anrdoezrs.net/click-101692716-13096743" }],
    ]);
    const expectedBannerUrls = new Map([
      ["cars-compare", "https://www.anrdoezrs.net/click-101692716-15736982?sid=travelplaninfo"],
      ["cruisedirect-deals", "https://www.dpbolvw.net/click-101692716-15734200?sid=travelplaninfo"],
      ["hotels-member-prices", "https://www.dpbolvw.net/click-101692716-15612526?sid=travelplaninfo"],
      ["vrbo-vacation-rentals", "https://www.jdoqocy.com/click-101692716-10784831?sid=travelplaninfo"],
    ]);

    expect(DEALS).toHaveLength(8);
    expect(DEALS.map((deal) => deal.id).sort()).toEqual(expectedDealIds);
    expect([...expectedDealContracts.keys()].sort()).toEqual(expectedDealIds);

    for (const deal of DEALS) {
      expect(deal.id).toBeTruthy();
      const expectedDeal = expectedDealContracts.get(deal.id);
      expect(expectedDeal, `${deal.id} missing from hardcoded affiliate contract manifest`).toBeDefined();
      if (!expectedDeal) continue;
      expect(deal.program, `${deal.id} affiliate program must match the approved contract`).toBe(expectedDeal.program);
      expect(deal.cta, `${deal.id} CTA must match the approved contract`).toBe(expectedDeal.cta);
      expect(getAffiliateUrl(deal), `${deal.id} href must match the approved contract`).toBe(expectedDeal.href);
      expectCjUrl(expectedDeal.href);
    }

    for (const [name, makeUrl] of Object.entries(CJ_LINKS)) {
      if (name === "airAdvisor") continue;
      const url = name === "hotelsCity" ? (makeUrl as (city: string) => string)("Miami") : (makeUrl as () => string)();
      expectCjUrl(url);
    }

    expect(CJ_BANNERS).toHaveLength(4);
    expect(CJ_BANNERS.map((banner) => banner.id).sort()).toEqual([...expectedBannerUrls.keys()].sort());

    for (const banner of CJ_BANNERS) {
      expect(banner.url).toBe(expectedBannerUrls.get(banner.id));
      expectCjUrl(banner.url);
    }

    const { container } = render(React.createElement(AffiliateSidebar));

    for (const deal of DEALS.slice(0, 3)) {
      const expectedDeal = expectedDealContracts.get(deal.id);
      expect(expectedDeal, `${deal.id} missing from hardcoded affiliate contract manifest`).toBeDefined();
      if (!expectedDeal) continue;
      const link = screen.getByRole("link", { name: new RegExp(deal.cta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
      expect(link.getAttribute("href")).toBe(expectedDeal.href);
    }

    for (const banner of CJ_BANNERS) {
      const link = container.querySelector<HTMLAnchorElement>(`a[href="${banner.url}"]`);
      expect(link).not.toBeNull();
      expect(link?.getAttribute("href")).toBe(banner.url);
    }

    cleanup();
  });
});
