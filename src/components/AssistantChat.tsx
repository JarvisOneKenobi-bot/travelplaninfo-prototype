"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import VoiceInput from "./VoiceInput";
import FlightCard from "./atlas/FlightCard";
import HotelCard from "./atlas/HotelCard";
import DealCard from "./atlas/DealCard";
import DestinationCard from "./atlas/DestinationCard";
import ArticleCard from "./atlas/ArticleCard";
import ActivityCard from "./atlas/ActivityCard";
import RestaurantCard from "./atlas/RestaurantCard";
import TripResultsModal from "./atlas/TripResultsModal";
import type { FlightResult, HotelResult, ActivityResult, RestaurantResult, BudgetTier } from "./atlas/types";

// ── Trip tool detection — only these tools trigger the modal ─────────────────

const TRIP_TOOLS = new Set(["search_flights", "search_hotels", "search_activities", "search_restaurants"]);

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

interface TripContext {
  destination: string;
  dates?: { start: string; end: string };
  adults: number;
  budgetTier: BudgetTier;
  tripId?: number;
}

interface ModalData {
  flights: FlightResult[];
  hotels: HotelResult[];
  activities: ActivityResult[];
  tripContext: TripContext;
}

// ── Quick-action chips ───────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Search flights", emoji: "\u2708\uFE0F", message: "Search flights for me" },
  { label: "Find hotels", emoji: "\uD83C\uDFE8", message: "Find me hotels" },
  { label: "Surprise me", emoji: "\uD83C\uDFB2", message: "Surprise me with 3 destination ideas" },
  { label: "Recommend an article", emoji: "\uD83D\uDCD6", message: "Recommend a travel guide article" },
];

// ── Helper: parse tool results from message content ──────────────────────────

interface ToolResult {
  type: "text" | "tool";
  toolName?: string;
  data?: Record<string, unknown>;
  text?: string;
}

function parseMessageContent(content: string): ToolResult[] {
  const parts: ToolResult[] = [];
  const markerPattern = /\[TOOL:(\w+)\]/g;

  let lastIndex = 0;
  let match;

  while ((match = markerPattern.exec(content)) !== null) {
    // Text before this tool marker
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: "text", text });
    }

    const toolName = match[1];
    const jsonStart = match.index + match[0].length;

    // Find matching JSON using brace counting (handles nested objects)
    if (jsonStart < content.length && content[jsonStart] === "{") {
      let depth = 0;
      let jsonEnd = jsonStart;
      for (let i = jsonStart; i < content.length; i++) {
        if (content[i] === "{") depth++;
        else if (content[i] === "}") {
          depth--;
          if (depth === 0) { jsonEnd = i + 1; break; }
        }
      }
      const jsonStr = content.slice(jsonStart, jsonEnd);
      try {
        const data = JSON.parse(jsonStr);
        parts.push({ type: "tool", toolName, data });
      } catch {
        parts.push({ type: "text", text: match[0] + jsonStr });
      }
      lastIndex = jsonEnd;
      markerPattern.lastIndex = jsonEnd;
    } else {
      parts.push({ type: "text", text: match[0] });
      lastIndex = match.index + match[0].length;
    }
  }

  // Remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) parts.push({ type: "text", text });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: content }];
}

// ── Helpers: parse numeric values from price strings + duration ──────────────

function parsePriceValue(priceStr: string): number {
  const match = priceStr.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function parseDurationMinutes(durationStr: string): number {
  const hMatch = durationStr.match(/(\d+)h/);
  const mMatch = durationStr.match(/(\d+)m/);
  return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
}

/** Count how many trip-specific tools appear in parsed parts */
function countTripTools(parts: ToolResult[]): number {
  const seen = new Set<string>();
  for (const p of parts) {
    if (p.type === "tool" && p.toolName && TRIP_TOOLS.has(p.toolName)) {
      seen.add(p.toolName);
    }
  }
  return seen.size;
}

/** Extract typed arrays from parsed tool results */
function extractTripData(parts: ToolResult[]): {
  flights: FlightResult[];
  hotels: HotelResult[];
  activities: ActivityResult[];
  restaurants: RestaurantResult[];
} {
  const flights: FlightResult[] = [];
  const hotels: HotelResult[] = [];
  const activities: ActivityResult[] = [];
  const restaurants: RestaurantResult[] = [];

  for (const p of parts) {
    if (p.type !== "tool" || !p.data) continue;

    if (p.toolName === "search_flights" && Array.isArray(p.data.flights)) {
      for (const f of p.data.flights as Record<string, unknown>[]) {
        const price = String(f.price || "$0");
        const duration = String(f.duration || "0h 0m");
        const stops = String(f.stops || "");
        flights.push({
          airline: String(f.airline || ""),
          route: String(f.route || ""),
          price,
          price_value: typeof f.price_value === "number" ? f.price_value : parsePriceValue(price),
          duration,
          duration_minutes: typeof f.duration_minutes === "number" ? f.duration_minutes : parseDurationMinutes(duration),
          stops,
          nonstop: typeof f.nonstop === "boolean" ? f.nonstop : /nonstop/i.test(stops),
          depart_date: f.depart_date ? String(f.depart_date) : undefined,
          return_date: f.return_date ? String(f.return_date) : undefined,
          book_url: String(f.book_url || ""),
        });
      }
    }

    if (p.toolName === "search_hotels" && Array.isArray(p.data.hotels)) {
      for (const h of p.data.hotels as Record<string, unknown>[]) {
        const priceNight = String(h.price_night || "$0");
        hotels.push({
          name: String(h.name || ""),
          price_night: priceNight,
          price_night_value: typeof h.price_night_value === "number" ? h.price_night_value : parsePriceValue(priceNight),
          total_cost: h.total_cost ? String(h.total_cost) : undefined,
          rating: typeof h.rating === "number" ? h.rating : 0,
          tier: (["budget", "mid", "luxury"].includes(String(h.tier)) ? String(h.tier) : "mid") as "budget" | "mid" | "luxury",
          book_url: String(h.book_url || ""),
        });
      }
    }

    if (p.toolName === "search_activities" && Array.isArray(p.data.activities)) {
      for (const a of p.data.activities as Record<string, unknown>[]) {
        const price = String(a.price || "$0");
        activities.push({
          name: String(a.name || ""),
          price,
          price_value: typeof a.price_value === "number" ? a.price_value : parsePriceValue(price),
          tier: (["budget", "mid", "luxury"].includes(String(a.tier)) ? String(a.tier) : "mid") as "budget" | "mid" | "luxury",
          interest: String(a.interest || "other"),
          duration: a.duration ? String(a.duration) : undefined,
        });
      }
    }

    if (p.toolName === "search_restaurants" && Array.isArray(p.data.restaurants)) {
      for (const r of p.data.restaurants as Record<string, unknown>[]) {
        restaurants.push({
          name: String(r.name || ""),
          cuisine: String(r.cuisine || ""),
          price_range: String(r.price_range || "$"),
          neighborhood: String(r.neighborhood || ""),
          rating: typeof r.rating === "number" ? r.rating : undefined,
          highlights: Array.isArray(r.highlights) ? (r.highlights as unknown[]).map(String) : [],
          budget_tier: (["budget", "mid", "luxury"].includes(String(r.budget_tier)) ? String(r.budget_tier) : "mid") as BudgetTier,
        });
      }
    }
  }

  return { flights, hotels, activities, restaurants };
}

/** Read trip context from the #atlas-trip-context script tag */
function readTripContext(): TripContext {
  const defaults: TripContext = {
    destination: "your destination",
    adults: 1,
    budgetTier: "mid",
  };

  try {
    const el = document.getElementById("atlas-trip-context");
    if (!el) return defaults;
    const data = JSON.parse(el.textContent || "{}");
    return {
      destination: data.destination || defaults.destination,
      dates: (data.startDate || data.start_date) && (data.endDate || data.end_date)
        ? { start: data.startDate || data.start_date, end: data.endDate || data.end_date }
        : undefined,
      adults: data.adults || data.travelers_adults || defaults.adults,
      budgetTier: (["budget", "mid", "luxury"].includes(data.budget) ? data.budget : "mid") as BudgetTier,
      tripId: data.tripId || data.trip_id || data.id,
    };
  } catch {
    return defaults;
  }
}

/** Get text-only summary from parsed parts (strips tool JSON) */
function getTextSummary(parts: ToolResult[]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text || "")
    .join(" ")
    .trim();
}

// ── Tool card renderers using dedicated card components ──────────────────────

function ToolResultCards({ toolName, data }: { toolName: string; data: Record<string, unknown> }) {
  if (toolName === "search_flights" && data.flights) {
    const flights = data.flights as Array<Record<string, string>>;
    return (
      <div className="space-y-2 my-2">
        {flights.map((f, i) => (
          <FlightCard key={i} flight={f as never} />
        ))}
      </div>
    );
  }

  if (toolName === "search_hotels" && data.hotels) {
    const hotels = data.hotels as Array<Record<string, unknown>>;
    return (
      <div className="space-y-2 my-2">
        {hotels.map((h, i) => (
          <HotelCard key={i} hotel={h as never} />
        ))}
      </div>
    );
  }

  if (toolName === "get_deals" && data.deals) {
    const deals = data.deals as Array<Record<string, unknown>>;
    return (
      <div className="space-y-2 my-2">
        {deals.map((d, i) => (
          <DealCard key={i} deal={d as never} />
        ))}
      </div>
    );
  }

  if (toolName === "surprise_me" && data.suggestions) {
    const suggestions = data.suggestions as Array<Record<string, unknown>>;
    return (
      <div className="space-y-2 my-2">
        {suggestions.map((s, i) => (
          <DestinationCard key={i} destination={s as never} />
        ))}
      </div>
    );
  }

  if (toolName === "get_article" && data.articles) {
    const articles = data.articles as Array<Record<string, string>>;
    return (
      <div className="space-y-2 my-2">
        {articles.map((a, i) => (
          <ArticleCard key={i} article={a as never} />
        ))}
      </div>
    );
  }

  if (toolName === "search_activities" && data.activities) {
    const activities = data.activities as Array<Record<string, string>>;
    return (
      <div className="space-y-2 my-2">
        {activities.map((a, i) => (
          <ActivityCard key={i} activity={a as never} />
        ))}
      </div>
    );
  }

  if (toolName === "search_restaurants" && data.restaurants) {
    const restaurants = data.restaurants as Array<Record<string, unknown>>;
    return (
      <div className="space-y-2 my-2">
        {restaurants.map((r, i) => (
          <RestaurantCard key={i} restaurant={r as never} />
        ))}
      </div>
    );
  }

  // Fallback: show raw JSON
  return (
    <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto my-2">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ── Markdown-lite renderer ───────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdownLite(text: string) {
  // Escape HTML first to prevent XSS — content comes from the LLM, which could
  // theoretically output raw HTML or be influenced by prompt injection.
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Links — only allow http(s) URLs to prevent javascript: protocol injection
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" class="text-orange-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // Also handle relative URLs (for TPI article links like /slug/)
  html = html.replace(
    /\[([^\]]+)\]\((\/[^)]+)\)/g,
    '<a href="$2" class="text-orange-600 hover:underline">$1</a>'
  );
  // Newlines to br
  html = html.replace(/\n/g, "<br/>");
  return html;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [hasBouncedOnce, setHasBouncedOnce] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgIdCounter = useRef(0);

  // ── Session management ──────────────────────────────────────────────────

  const createSession = useCallback(async () => {
    try {
      const res = await fetch("/api/assistant/sessions", { method: "POST" });
      if (!res.ok) return null;
      const data = await res.json();
      sessionStorage.setItem("atlas_session_id", data.id);
      setSessionId(data.id);
      return data.id;
    } catch {
      return null;
    }
  }, []);

  const loadHistory = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/assistant/history/${sid}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setMessages(
          data.map((m: { id: number; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
        msgIdCounter.current = Math.max(...data.map((m: { id: number }) => m.id), 0);
      }
    } catch {
      // Silently fail — fresh session
    }
  }, []);

  useEffect(() => {
    const storedSid = sessionStorage.getItem("atlas_session_id");
    if (storedSid) {
      setSessionId(storedSid);
      loadHistory(storedSid);
    }
    // Check bounce animation flag
    if (!localStorage.getItem("atlas_bounced")) {
      setHasBouncedOnce(true);
      localStorage.setItem("atlas_bounced", "1");
    }
  }, [loadHistory]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setError(null);

      // Ensure session exists
      let sid = sessionId;
      if (!sid) {
        sid = await createSession();
        if (!sid) {
          setError("Could not create chat session. Please sign in.");
          return;
        }
      }

      // Add user message
      const userMsgId = ++msgIdCounter.current;
      const userMsg: ChatMessage = { id: userMsgId, role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      // Add placeholder assistant message
      const assistantMsgId = ++msgIdCounter.current;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "", isStreaming: true },
      ]);

      try {
        // Build rich page context — include trip data if on itinerary page
        let pageContext = window.location.pathname + " | " + document.title;
        const tripContextEl = document.getElementById("atlas-trip-context");
        if (tripContextEl) {
          try {
            const tripData = JSON.parse(tripContextEl.textContent || "{}");
            pageContext += "\n\nActive trip: " + JSON.stringify(tripData);
          } catch { /* ignore parse errors */ }
        }

        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            session_id: sid,
            page_context: pageContext,
          }),
        });

        if (res.status === 429) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: "Atlas has reached the daily limit. Try again tomorrow.", isStreaming: false }
                : m
            )
          );
          setIsLoading(false);
          return;
        }

        if (!res.ok || !res.body) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: "Connection lost. Please try again.", isStreaming: false }
                : m
            )
          );
          setIsLoading(false);
          return;
        }

        // Stream SSE
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() || "";

          for (const frame of frames) {
            if (!frame.startsWith("data: ")) continue;
            const data = frame.slice(6);

            if (data === "[DONE]") continue;

            // Check for error
            if (data.startsWith("{\"error\"")) {
              try {
                const errObj = JSON.parse(data);
                fullText += errObj.error || "An error occurred.";
              } catch {
                fullText += data;
              }
              continue;
            }

            // Tool result — append as-is (will be parsed by renderer)
            if (data.startsWith("[TOOL:")) {
              fullText += data;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: fullText } : m
                )
              );
              continue;
            }

            // Regular text token
            fullText += data;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: fullText } : m
              )
            );
          }
        }

        // Mark streaming complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          )
        );

        // Voice output (TTS)
        if (voiceEnabled && fullText && !fullText.startsWith("[TOOL:")) {
          try {
            const cleanText = fullText
              .replace(/\[TOOL:\w+\]\{[\s\S]*?\}/g, "")
              .replace(/\*\*/g, "")
              .trim();
            if (cleanText && "speechSynthesis" in window) {
              const utterance = new SpeechSynthesisUtterance(cleanText);
              utterance.rate = 1.0;
              utterance.pitch = 1.0;
              window.speechSynthesis.speak(utterance);
            }
          } catch {
            // TTS not critical
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: "Connection lost. Tap to retry.", isStreaming: false }
              : m
          )
        );
      }

      setIsLoading(false);
    },
    [sessionId, isLoading, createSession, voiceEnabled]
  );

  // ── New chat ──────────────────────────────────────────────────────────────

  const handleNewChat = useCallback(async () => {
    setMessages([]);
    setError(null);
    sessionStorage.removeItem("atlas_session_id");
    setSessionId(null);
    await createSession();
  }, [createSession]);

  // ── Render ────────────────────────────────────────────────────────────────

  const showQuickActions = messages.length === 0 || (!isLoading && messages.length > 0);

  return (
    <>
      {/* Floating bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={[
            "fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full",
            "bg-orange-500 hover:bg-orange-600 text-white shadow-lg",
            "flex items-center justify-center transition-all",
            hasBouncedOnce ? "animate-bounce" : "",
          ].join(" ")}
          title="Ask Atlas"
          onAnimationEnd={() => setHasBouncedOnce(false)}
        >
          {/* Compass icon */}
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="currentColor" stroke="none" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-[90] w-full sm:w-[400px] h-[calc(100vh-64px)] sm:h-[600px] sm:bottom-6 sm:right-6 flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-orange-500 text-white">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="currentColor" stroke="none" />
              </svg>
              <span className="font-semibold">Atlas</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Voice toggle */}
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={[
                  "p-1.5 rounded-full transition-colors",
                  voiceEnabled ? "bg-orange-400" : "hover:bg-orange-400/50",
                ].join(" ")}
                title={voiceEnabled ? "Mute Atlas voice" : "Enable Atlas voice"}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {voiceEnabled ? (
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </>
                  ) : (
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </>
                  )}
                </svg>
              </button>
              {/* New chat */}
              <button
                onClick={handleNewChat}
                className="p-1.5 rounded-full hover:bg-orange-400/50 transition-colors"
                title="New chat"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              {/* Minimize */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-orange-400/50 transition-colors"
                title="Minimize"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center mt-8">
                <p className="text-4xl mb-3">{"\uD83E\uDDED"}</p>
                <p className="font-medium text-gray-700">Hi! I&apos;m Atlas</p>
                <p className="text-sm text-gray-500 mt-1">
                  Your AI travel concierge. Ask me about flights, hotels, destinations, or travel tips.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              // ── Multi-tool trip detection (assistant messages only) ──
              const parsed = msg.role === "assistant" ? parseMessageContent(msg.content) : [];
              const tripToolCount = msg.role === "assistant" ? countTripTools(parsed) : 0;
              const isMultiTripTool = tripToolCount >= 2;

              return (
                <div
                  key={msg.id}
                  className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={[
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "user"
                        ? "bg-orange-500 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-800 rounded-bl-md",
                    ].join(" ")}
                  >
                    {msg.role === "assistant" ? (
                      <div>
                        {isMultiTripTool ? (
                          <>
                            {/* Show text summary only (strip tool JSON) */}
                            {(() => {
                              const summary = getTextSummary(parsed);
                              return summary ? (
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: renderMarkdownLite(summary),
                                  }}
                                />
                              ) : null;
                            })()}
                            {/* Render non-trip tool results inline as before */}
                            {parsed
                              .filter(
                                (p) =>
                                  p.type === "tool" &&
                                  p.toolName &&
                                  !TRIP_TOOLS.has(p.toolName) &&
                                  p.data
                              )
                              .map((part, i) => (
                                <ToolResultCards
                                  key={`nontool-${i}`}
                                  toolName={part.toolName!}
                                  data={part.data!}
                                />
                              ))}
                            {/* "View Full Plan" button — only when streaming is complete */}
                            {!msg.isStreaming && (
                              <button
                                onClick={() => {
                                  const tripData = extractTripData(parsed);
                                  const ctx = readTripContext();
                                  setModalData({
                                    flights: tripData.flights,
                                    hotels: tripData.hotels,
                                    activities: tripData.activities,
                                    tripContext: ctx,
                                  });
                                  setModalOpen(true);
                                }}
                                className="mt-3 w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                  <line x1="3" y1="9" x2="21" y2="9" />
                                  <line x1="9" y1="21" x2="9" y2="9" />
                                </svg>
                                View Full Plan
                              </button>
                            )}
                          </>
                        ) : (
                          /* Standard rendering: inline cards for single-tool or non-trip tools */
                          parsed.map((part, i) => {
                            if (part.type === "tool" && part.toolName && part.data) {
                              return (
                                <ToolResultCards
                                  key={i}
                                  toolName={part.toolName}
                                  data={part.data}
                                />
                              );
                            }
                            return (
                              <span
                                key={i}
                                dangerouslySetInnerHTML={{
                                  __html: renderMarkdownLite(part.text || ""),
                                }}
                              />
                            );
                          })
                        )}
                        {msg.isStreaming && (
                          <span className="inline-flex gap-1 ml-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </span>
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {showQuickActions && (
            <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-gray-100">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.message)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-600 hover:text-orange-600 transition-colors disabled:opacity-50"
                >
                  {action.emoji} {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
              {error}
            </div>
          )}

          {/* Input bar */}
          <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask Atlas..."
              disabled={isLoading}
              className="flex-1 text-sm px-3 py-2 rounded-full border border-gray-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none disabled:opacity-50"
            />
            <VoiceInput
              onTranscription={(text) => {
                setInput((prev) => (prev ? prev + " " + text : text));
                inputRef.current?.focus();
              }}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:hover:bg-orange-500 transition-colors"
              title="Send"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Trip Results Modal */}
      {modalData && (
        <TripResultsModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          destination={modalData.tripContext.destination}
          dates={modalData.tripContext.dates}
          adults={modalData.tripContext.adults}
          flights={modalData.flights}
          hotels={modalData.hotels}
          activities={modalData.activities}
          budgetTier={modalData.tripContext.budgetTier}
          tripId={modalData.tripContext.tripId}
        />
      )}
    </>
  );
}
