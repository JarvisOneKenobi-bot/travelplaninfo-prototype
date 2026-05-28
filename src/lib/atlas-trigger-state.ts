// Atlas trigger governance — pure state machine.
// No React, no DOM, no side effects. Easy to unit test.

export type TriggerStatus =
  | 'idle' | 'awaiting_consent' | 'consented' | 'searching' | 'done' | 'declined';

export interface TriggerState {
  status: TriggerStatus;
  tripId: number | null;
  destination: string | null;
}

export type TriggerAction =
  | { type: 'enterTripContext'; tripId: number; destination: string;
      hasItems: boolean; isSurpriseMe: boolean; hasPriorMessages: boolean }
  | { type: 'userConsent' }
  | { type: 'userDecline' }
  | { type: 'searchStarted' }
  | { type: 'searchFinished' };

export const initialTriggerState: TriggerState = {
  status: 'idle',
  tripId: null,
  destination: null,
};

export function triggerReducer(state: TriggerState, action: TriggerAction): TriggerState {
  switch (action.type) {
    case 'enterTripContext': {
      const shouldPrompt =
        !!action.destination &&
        action.destination !== 'Surprise Me' &&
        !action.hasItems &&
        !action.isSurpriseMe &&
        !action.hasPriorMessages; // preserves AssistantChat.tsx:831-832 returning-user guard
      return {
        status: shouldPrompt ? 'awaiting_consent' : 'idle',
        tripId: action.tripId,
        destination: action.destination,
      };
    }
    case 'userConsent':
      return state.status === 'awaiting_consent' ? { ...state, status: 'consented' } : state;
    case 'userDecline':
      return state.status === 'awaiting_consent' ? { ...state, status: 'declined' } : state;
    case 'searchStarted':
      return state.status === 'consented' ? { ...state, status: 'searching' } : state;
    case 'searchFinished':
      return state.status === 'searching' ? { ...state, status: 'done' } : state;
    default:
      return state;
  }
}

// ── Nudge state machine ──────────────────────────────────────────────────

export type Section =
  | 'chooser'
  | 'flight-no-origin'
  | 'flight-no-destination'
  | 'explore-no-vibes'
  | 'explore-no-interests'
  | 'complete';

const NUDGE_DELAY_MS = 30_000;

export interface NudgeState {
  section: Section | null;
  lastInteractionAt: number;
  emittedSections: Section[];
  pendingNudge: Section | null;
}

export type NudgeAction =
  | { type: 'setSection'; section: Section; now: number }
  | { type: 'interaction'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'consumeNudge' };

export const initialNudgeState: NudgeState = {
  section: null,
  lastInteractionAt: 0,
  emittedSections: [],
  pendingNudge: null,
};

export function nudgeReducer(state: NudgeState, action: NudgeAction): NudgeState {
  switch (action.type) {
    case 'setSection':
      return { ...state, section: action.section, lastInteractionAt: action.now, pendingNudge: null };
    case 'interaction':
      return { ...state, lastInteractionAt: action.now, pendingNudge: null };
    case 'tick': {
      if (!state.section || state.section === 'complete') return state;
      if (state.emittedSections.includes(state.section)) return state;
      const idleMs = action.now - state.lastInteractionAt;
      if (idleMs >= NUDGE_DELAY_MS) {
        return {
          ...state,
          pendingNudge: state.section,
          emittedSections: [...state.emittedSections, state.section],
        };
      }
      return state;
    }
    case 'consumeNudge':
      return { ...state, pendingNudge: null };
    default:
      return state;
  }
}

// ── Window typing for __atlasFormContext (set by TripForm) ──────────────
// Allows strict TypeScript to compile detectSection() in useAtlasBubble.ts
// without `(window as any)` casts.

export interface AtlasFormContext {
  mode: 'chooser' | 'flight' | 'explore';
  origin?: string;
  destination?: string;
  vibes?: string[];
  interests?: string[];
  budget?: string;
  travelers?: { adults: number; children: number };
}

declare global {
  interface Window {
    __atlasFormContext?: AtlasFormContext;
  }
}
