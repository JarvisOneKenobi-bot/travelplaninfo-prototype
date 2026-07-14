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
];
const I18N_PATTERNS = [...PRICE_PATTERNS, /\blive\b/i, /\bfeed\b/i, /\bflux\b/i];
// Keep price-shaped i18n checks dollar/night/day/person scoped. affiliateRecommendations.airAdvisorDesc
// includes EU261's real, regulation-backed €600 compensation cap, so euro/pound literals are not
// fabricated-price signals in this namespace.
const AFFILIATE_RECOMMENDATIONS_PATTERNS = [
  ...PRICE_PATTERNS,
  /\d+\s*%/,
  /last[-\s]?minute/i,
  /último minuto/i,
  /última hora/i,
  /dernière minute/i,
  /tonight/i,
  /limited (?:inventory|time)/i,
  /hurry/i,
  /\bdeals?\b/i,
  /\bofertas?\b/i,
  /\boffres?\b/i,
  /\bangebote?\b/i,
  /\bofferte?\b/i,
];

const SOURCE_FILES = [
  "src/app/[locale]/destinations/page.tsx",
  "src/app/[locale]/hot-deals/page.tsx",
  "src/config/affiliates.ts",
  "src/components/ArticleAffiliateCTA.tsx",
  "src/components/AffiliateInlineCTA.tsx",
] as const;

const URGENCY_SOURCE_FILES = [
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

function collectI18nNamespaceViolations(namespace: string, patterns: RegExp[]): Violation[] {
  const violations: Violation[] = [];

  for (const locale of LOCALES) {
    const file = `messages/${locale}/common.json`;
    const raw = readRepoFile(file);
    const json = JSON.parse(raw) as Record<string, unknown>;
    for (const text of collectJsonStrings(json[namespace])) {
      const normalized = normalizeMatchedText(text);
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
    // a revenue link silently re-pointed at the wrong advertiser must fail the build.
    const expectedDealUrls = new Map([
      ["hotels-miami-beach", "https://www.dpbolvw.net/click-101692716-15734399?sid=travelplaninfo"],
      ["vrbo-miami-condo", "https://www.jdoqocy.com/click-101692716-10784831?sid=travelplaninfo"],
      ["cars-miami", "https://www.jdoqocy.com/click-101692716-15586457"],
      ["cruisedirect-caribbean", "https://www.kqzyfj.com/click-101692716-13096782"],
      ["hotels-cancun", "https://www.dpbolvw.net/click-101692716-15734399?sid=travelplaninfo"],
      ["cars-cancun", "https://www.jdoqocy.com/click-101692716-15586457"],
      ["vrbo-nyc-apartment", "https://www.jdoqocy.com/click-101692716-10784831?sid=travelplaninfo"],
      ["cruisedirect-bahamas", "https://www.anrdoezrs.net/click-101692716-13096743"],
    ]);
    const expectedBannerUrls = new Map([
      ["cars-compare", "https://www.anrdoezrs.net/click-101692716-15736982?sid=travelplaninfo"],
      ["cruisedirect-deals", "https://www.dpbolvw.net/click-101692716-15734200?sid=travelplaninfo"],
      ["hotels-member-prices", "https://www.dpbolvw.net/click-101692716-15612526?sid=travelplaninfo"],
      ["vrbo-vacation-rentals", "https://www.jdoqocy.com/click-101692716-10784831?sid=travelplaninfo"],
    ]);

    expect(DEALS).toHaveLength(8);
    expect(DEALS.map((deal) => deal.id).sort()).toEqual(expectedDealIds);
    expect([...expectedDealUrls.keys()].sort()).toEqual(expectedDealIds);

    for (const deal of DEALS) {
      expect(deal.id).toBeTruthy();
      expect(deal.program).toBeTruthy();
      expect(deal.cta).toBeTruthy();
      const expectedUrl = expectedDealUrls.get(deal.id);
      expect(expectedUrl, `${deal.id} missing from hardcoded affiliate URL manifest`).toBeTruthy();
      expect(getAffiliateUrl(deal)).toBe(expectedUrl);
      expectCjUrl(expectedUrl as string);
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
      const link = screen.getByRole("link", { name: new RegExp(deal.cta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
      expect(link.getAttribute("href")).toBe(expectedDealUrls.get(deal.id));
    }

    for (const banner of CJ_BANNERS) {
      const link = container.querySelector<HTMLAnchorElement>(`a[href="${banner.url}"]`);
      expect(link).not.toBeNull();
      expect(link?.getAttribute("href")).toBe(banner.url);
    }

    cleanup();
  });
});
