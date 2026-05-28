"use client";

import { useEffect, useReducer, useRef } from "react";
import {
  triggerReducer, initialTriggerState,
  type TriggerState, type TriggerAction,
} from "@/lib/atlas-trigger-state";

interface UseAtlasTriggerArgs {
  tripId: number | null;
  destination: string | null;
  hasItems: boolean;
  isSurpriseMe: boolean;
  hasPriorMessages: boolean;
}

export function useAtlasTrigger({ tripId, destination, hasItems, isSurpriseMe, hasPriorMessages }: UseAtlasTriggerArgs) {
  const [state, dispatch] = useReducer(triggerReducer, initialTriggerState);
  const lastTripId = useRef<number | null>(null);

  useEffect(() => {
    if (tripId === null || !destination) return;
    if (lastTripId.current === tripId) return;
    lastTripId.current = tripId;
    dispatch({ type: 'enterTripContext', tripId, destination, hasItems, isSurpriseMe, hasPriorMessages });
  }, [tripId, destination, hasItems, isSurpriseMe, hasPriorMessages]);

  return {
    status: state.status,
    requestConsent: () => dispatch({ type: 'userConsent' }),
    declineConsent: () => dispatch({ type: 'userDecline' }),
    markSearchStarted: () => dispatch({ type: 'searchStarted' }),
    markSearchFinished: () => dispatch({ type: 'searchFinished' }),
  };
}
