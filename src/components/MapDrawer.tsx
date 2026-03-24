/// <reference types="@types/google.maps" />
"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { useTranslations } from "next-intl";

export interface MapItem {
  id: number;
  day_number: number;
  category: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: MapItem[];
  destination: string;
  totalDays: number;
  hoveredItemId: number | null;
  onPinClick: (itemId: number) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  flight: "#F97316",
  hotel: "#3B82F6",
  car_rental: "#14B8A6",
  activity: "#A855F7",
  restaurant: "#EAB308",
  transportation: "#06B6D4",
  note: "#6B7280",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#6B7280";
}

type GoogleMap = google.maps.Map;
type AdvancedMarker = google.maps.marker.AdvancedMarkerElement;
type Polyline = google.maps.Polyline;

export default function MapDrawer({
  isOpen,
  onClose,
  items,
  destination,
  totalDays,
  hoveredItemId,
  onPinClick,
}: Props) {
  const t = useTranslations("mapDrawer");
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<GoogleMap>(null);
  const markersRef = useRef<Map<number, AdvancedMarker>>(new Map());
  const polylinesRef = useRef<Polyline[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

  // Filter items with valid coordinates
  const mappableItems = items.filter(
    (item) => item.latitude != null && item.longitude != null
  );

  const filteredItems =
    selectedDay === null
      ? mappableItems
      : mappableItems.filter((item) => item.day_number === selectedDay);

  // Initialize Google Maps
  useEffect(() => {
    if (!isOpen || !mapRef.current || mapLoaded || !apiKey) return;

    let cancelled = false;

    const initMap = async () => {
      try {
        setOptions({ key: apiKey, v: "weekly" });
        const { Map } = await importLibrary("maps") as { Map: typeof google.maps.Map };
        await importLibrary("marker");

        if (cancelled || !mapRef.current) return;

        const map = new Map(mapRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapId: "tpi-itinerary-map",
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        googleMapRef.current = map;
        setMapLoaded(true);
      } catch {
        if (!cancelled) setMapError(true);
      }
    };

    initMap();
    return () => { cancelled = true; };
  }, [isOpen, apiKey, mapLoaded]);

  // Update markers and polylines when items/filter changes
  useEffect(() => {
    if (!mapLoaded || !googleMapRef.current) return;

    const map = googleMapRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current.clear();

    // Clear existing polylines
    polylinesRef.current.forEach((line: Polyline) => line.setMap(null));
    polylinesRef.current = [];

    if (filteredItems.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    // Create numbered pin markers
    filteredItems.forEach((item, index) => {
      if (item.latitude == null || item.longitude == null) return;

      const position = { lat: item.latitude, lng: item.longitude };
      bounds.extend(position);

      const color = getCategoryColor(item.category);
      const pinNumber = index + 1;

      // Custom pin element
      const pinEl = document.createElement("div");
      pinEl.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background-color: ${color};
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
        transition: transform 0.15s ease;
      `;
      pinEl.textContent = String(pinNumber);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: item.title,
        content: pinEl,
      });

      marker.addListener("click", () => {
        onPinClick(item.id);
      });

      markersRef.current.set(item.id, marker);
    });

    // Draw polylines connecting same-day pins
    const dayGroups = new Map<number, MapItem[]>();
    filteredItems.forEach((item) => {
      const arr = dayGroups.get(item.day_number) || [];
      arr.push(item);
      dayGroups.set(item.day_number, arr);
    });

    dayGroups.forEach((dayItems) => {
      if (dayItems.length < 2) return;
      const path = dayItems
        .filter((i) => i.latitude != null && i.longitude != null)
        .map((i) => ({ lat: i.latitude!, lng: i.longitude! }));

      if (path.length < 2) return;

      const line = new google.maps.Polyline({
        path,
        geodesic: false,
        strokeColor: "#94A3B8",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        map,
      });
      polylinesRef.current.push(line);
    });

    // Fit map to bounds
    if (!bounds.isEmpty()) {
      if (filteredItems.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(13);
      } else {
        map.fitBounds(bounds, 40);
      }
    }
  }, [mapLoaded, filteredItems, onPinClick]);

  // Scale hovered marker
  useEffect(() => {
    if (!mapLoaded) return;

    markersRef.current.forEach((marker: AdvancedMarker, itemId: number) => {
      const el = marker.content as HTMLDivElement;
      if (!el) return;
      if (itemId === hoveredItemId) {
        el.style.transform = "scale(1.4)";
        el.style.zIndex = "10";
      } else {
        el.style.transform = "scale(1)";
        el.style.zIndex = "1";
      }
    });
  }, [hoveredItemId, mapLoaded]);

  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 flex flex-col bg-white shadow-2xl w-full md:w-[450px] border-l border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h2 className="font-semibold text-gray-900 text-sm">{t("tripMap")}</h2>
            {destination && <span className="text-xs text-gray-500">{destination}</span>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
            aria-label="Close map"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Day filter pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 overflow-x-auto shrink-0">
          <button
            onClick={() => setSelectedDay(null)}
            className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              selectedDay === null
                ? "bg-orange-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t("all")}
          </button>
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d === selectedDay ? null : d)}
              className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                selectedDay === d
                  ? "bg-orange-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t("day")} {d}
            </button>
          ))}
        </div>

        {/* Map area */}
        <div className="flex-1 relative">
          {mapError ? (
            // Fallback: address list
            <div className="absolute inset-0 overflow-y-auto p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">{t("mapUnavailable")}</p>
              {filteredItems.length === 0 ? (
                <p className="text-sm text-gray-400 italic">{t("noLocations")}</p>
              ) : (
                filteredItems.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => onPinClick(item.id)}
                    className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <span
                      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: getCategoryColor(item.category) }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400">{t("day")} {item.day_number}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              <div ref={mapRef} className="absolute inset-0" />
              {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500">{t("loadingMap")}</p>
                  </div>
                </div>
              )}
              {mapLoaded && filteredItems.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center bg-white/90 rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">{t("noMappedLocations")}</p>
                    <p className="text-xs text-gray-400 mt-1">{t("addItems")}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Legend */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {Object.entries(CATEGORY_COLORS)
              .filter(([key]) => key !== "note")
              .map(([key, color]) => (
                <div key={key} className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-600 capitalize">
                    {t(`category_${key}`, { defaultValue: key })}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
