import "server-only";

import type { SurpriseResult } from "./surprise";
import type { DealCardOption, FlightCardOption } from "./travelpayouts-client";
import { resolveCityName } from "./city-names";
import { resolveMetro } from "./metro";

const RAW_CODE_PATTERN = /^[A-Z]{3}$/;

function unnameableReason(kind: "deals" | "flights"): string {
  return kind === "deals"
    ? "Live deals were returned, but none could be shown because their destination airports could not be named honestly."
    : "Live flights were returned, but none could be shown because at least one airport in each route could not be named honestly.";
}

function sameMetroOnlyReason(): string {
  return "Live deals were returned, but they were only same-metro airport hops for the requested origin, so Atlas did not show them as destination deals.";
}

function combinedDealDropReason(): string {
  return "Live deals were returned, but none could be shown because some destination airports could not be named honestly and the rest were same-metro airport hops for the requested origin.";
}

function surpriseTagline(destination: { airline: string; nonstop: boolean }): string {
  if (destination.nonstop && destination.airline) return `Nonstop on ${destination.airline}`;
  if (destination.airline) return destination.airline;
  if (destination.nonstop) return "Nonstop";
  return "Popular route";
}

export function renderSurpriseToolResult(result: SurpriseResult):
  | {
      suggestions: Array<{ city: string; tagline: string; estimated_flight: string }>;
      notice?: SurpriseResult["notice"];
    }
  | { suggestions: []; no_data: true; reason: string; notice?: SurpriseResult["notice"] } {
  if (result.destinations.length === 0) {
    return {
      suggestions: [],
      no_data: true,
      reason: result.degraded?.reason ?? "Atlas could not find surprise destinations to show without guessing.",
      ...(result.notice ? { notice: result.notice } : {}),
    };
  }

  return {
    suggestions: result.destinations.map((destination) => ({
      city: destination.name,
      tagline: surpriseTagline(destination),
      estimated_flight: destination.flightPrice,
    })),
    ...(result.notice ? { notice: result.notice } : {}),
  };
}

export function renderDealsToolResult<T extends { deals: DealCardOption[] } | { deals: []; no_data: true; reason: string }>(
  result: T,
  origin: string,
  explicitDestination?: string
): T | { deals: DealCardOption[] } | { deals: []; no_data: true; reason: string } {
  if ("no_data" in result) return result;

  const originMetro = resolveMetro(origin);
  const hasExplicitDestination = Boolean(explicitDestination?.trim());
  let unnameableDrops = 0;
  let sameMetroDrops = 0;
  const deals = result.deals.flatMap((deal) => {
    const city = resolveCityName(deal.destination);
    if (!city) {
      unnameableDrops += 1;
      return [];
    }
    if (!hasExplicitDestination && resolveMetro(deal.destination) === originMetro) {
      sameMetroDrops += 1;
      return [];
    }
    return [{ ...deal, destination: city }];
  });

  if (deals.length === 0) {
    const reason = unnameableDrops > 0 && sameMetroDrops > 0
      ? combinedDealDropReason()
      : sameMetroDrops > 0
        ? sameMetroOnlyReason()
        : unnameableReason("deals");
    return { deals: [], no_data: true, reason };
  }

  return { ...result, deals };
}

export function renderSearchFlightsToolResult<
  T extends
    | {
        flights: FlightCardOption[];
        airports_searched: string[];
        destinations_searched: string[];
        origin: string;
        destination: string;
      }
    | {
        flights: [];
        no_data: true;
        reason: string;
        origin: string;
        destination: string;
        airports_searched: string[];
        destinations_searched: string[];
      },
>(result: T): T | Omit<Extract<T, { flights: FlightCardOption[] }>, "flights"> & { flights: FlightCardOption[] } {
  if ("no_data" in result) return result;

  const flights = result.flights.flatMap((flight) => {
    const routeParts = flight.route.split(" → ");
    if (routeParts.length !== 2) return [];
    const [originCode, destinationCode] = routeParts;
    if (!RAW_CODE_PATTERN.test(originCode) || !RAW_CODE_PATTERN.test(destinationCode)) return [];
    const originName = resolveCityName(originCode);
    const destinationName = resolveCityName(destinationCode);
    if (!originName || !destinationName) return [];
    const route = `${originName} → ${destinationName}`;
    if (RAW_CODE_PATTERN.test(originName) || RAW_CODE_PATTERN.test(destinationName)) return [];
    return [{ ...flight, route }];
  });

  if (flights.length === 0) {
    return { ...result, flights: [], no_data: true as const, reason: unnameableReason("flights") };
  }

  return { ...result, flights };
}
