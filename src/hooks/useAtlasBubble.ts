// Manages talk bubble state: which message to show, when, interaction tracking
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface BubbleMessage {
  id: string;
  text: string;
  context: string; // which page/section this applies to
}

const BUBBLE_MESSAGES: BubbleMessage[] = [
  // Planner landing
  { id: 'planner-intro', text: "Hey! I'm Atlas, your travel concierge. Need help planning?", context: 'planner' },
  { id: 'planner-destination', text: "Can't decide where to go? Tell me what vibe you're looking for", context: 'planner' },
  { id: 'planner-explore', text: "Nice picks! When you're ready, hit the button and I'll craft your perfect trip", context: 'planner' },
  { id: 'planner-budget', text: "Tip: toggle 'Let Atlas find the cheapest dates' and I'll do the date math for you", context: 'planner' },
  // Itinerary page
  { id: 'itinerary-empty', text: "Your itinerary looks empty — want me to suggest some activities?", context: 'itinerary' },
  { id: 'itinerary-idle', text: "Need a hand? I can search flights, hotels, or activities for you", context: 'itinerary' },
  { id: 'itinerary-interests', text: "Tap the mic and tell me what you're into — it's faster!", context: 'itinerary' },
];

export function useAtlasBubble(isAtlasOpen: boolean) {
  const [currentBubble, setCurrentBubble] = useState<BubbleMessage | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const pathname = usePathname();
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownRef = useRef(false);
  const lastShownRef = useRef<number>(0);

  // Determine page context
  const pageContext = pathname?.includes('/planner/') && pathname.split('/').length > 3
    ? 'itinerary' : pathname?.includes('/planner') ? 'planner' : 'other';

  // Check if a bubble ID was already shown this session (per trip)
  const getStorageKey = useCallback(() => {
    const tripMatch = pathname?.match(/\/planner\/(\d+)/);
    return tripMatch ? `atlas_bubbles_${tripMatch[1]}` : 'atlas_bubbles_global';
  }, [pathname]);

  const wasShown = useCallback((id: string) => {
    try {
      const shown = JSON.parse(sessionStorage.getItem(getStorageKey()) || '[]');
      return shown.includes(id);
    } catch { return false; }
  }, [getStorageKey]);

  const markShown = useCallback((id: string) => {
    try {
      const shown = JSON.parse(sessionStorage.getItem(getStorageKey()) || '[]');
      if (!shown.includes(id)) {
        shown.push(id);
        sessionStorage.setItem(getStorageKey(), JSON.stringify(shown));
      }
    } catch {}
  }, [getStorageKey]);

  // Check localStorage for first-time ever
  const isFirstTimeEver = useCallback(() => {
    return !localStorage.getItem('atlas_introduced');
  }, []);

  const markIntroduced = useCallback(() => {
    localStorage.setItem('atlas_introduced', '1');
  }, []);

  // Increment interaction counter
  const trackInteraction = useCallback(() => {
    setInteractionCount(c => c + 1);
  }, []);

  // Dismiss current bubble
  const dismissBubble = useCallback(() => {
    setCurrentBubble(null);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  // Try to show a bubble
  const tryShowBubble = useCallback(() => {
    if (isAtlasOpen || cooldownRef.current || currentBubble) return;

    // Enforce 30s cooldown between bubbles
    const now = Date.now();
    if (now - lastShownRef.current < 30000) return;

    // Determine threshold based on first-time vs returning
    const threshold = isFirstTimeEver() ? 2 : 3;
    if (interactionCount < threshold) return;

    // Find first unshown message for current context
    const candidates = BUBBLE_MESSAGES.filter(
      m => m.context === pageContext && !wasShown(m.id)
    );

    // First-time intro gets priority
    if (isFirstTimeEver() && !wasShown('planner-intro')) {
      const intro = BUBBLE_MESSAGES.find(m => m.id === 'planner-intro');
      if (intro) {
        setCurrentBubble(intro);
        markShown(intro.id);
        markIntroduced();
        lastShownRef.current = now;
        // Auto-dismiss after 8 seconds
        dismissTimerRef.current = setTimeout(() => setCurrentBubble(null), 8000);
        return;
      }
    }

    if (candidates.length === 0) return;

    const msg = candidates[0];
    setCurrentBubble(msg);
    markShown(msg.id);
    lastShownRef.current = now;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 30000);
    dismissTimerRef.current = setTimeout(() => setCurrentBubble(null), 8000);
  }, [isAtlasOpen, currentBubble, interactionCount, pageContext, wasShown, markShown, isFirstTimeEver, markIntroduced]);

  // Trigger bubble check when interaction count changes
  useEffect(() => {
    if (interactionCount > 0) tryShowBubble();
  }, [interactionCount, tryShowBubble]);

  // Idle timer: show bubble after 30s of no interaction on itinerary page
  useEffect(() => {
    if (pageContext !== 'itinerary' || isAtlasOpen) return;

    const idleTimer = setTimeout(() => {
      if (!currentBubble && !isAtlasOpen) {
        const idleMsg = BUBBLE_MESSAGES.find(m => m.id === 'itinerary-idle' && !wasShown(m.id));
        if (idleMsg) {
          setCurrentBubble(idleMsg);
          markShown(idleMsg.id);
          lastShownRef.current = Date.now();
          dismissTimerRef.current = setTimeout(() => setCurrentBubble(null), 8000);
        }
      }
    }, 30000);

    return () => clearTimeout(idleTimer);
  }, [pageContext, isAtlasOpen, currentBubble, wasShown, markShown]);

  // Dismiss when Atlas opens
  useEffect(() => {
    if (isAtlasOpen) dismissBubble();
  }, [isAtlasOpen, dismissBubble]);

  // Listen for global atlas-interaction events (from ItineraryBuilder / TripForm)
  useEffect(() => {
    const handler = () => trackInteraction();
    window.addEventListener('atlas-interaction', handler);
    return () => window.removeEventListener('atlas-interaction', handler);
  }, [trackInteraction]);

  // Click-outside handler to dismiss bubble
  useEffect(() => {
    if (!currentBubble) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-atlas-bubble]')) return;
      dismissBubble();
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [currentBubble, dismissBubble]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); };
  }, []);

  return {
    currentBubble,
    dismissBubble,
    trackInteraction,
  };
}
