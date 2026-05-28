import { describe, it, expect } from 'vitest';
import {
  initialTriggerState, triggerReducer,
  initialNudgeState, nudgeReducer,
  type TriggerState, type NudgeState, type Section,
} from './atlas-trigger-state';

const defaultCtx = { hasItems: false, isSurpriseMe: false, hasPriorMessages: false };

describe('triggerReducer', () => {
  it('enters awaiting_consent on first real-destination trip with no items + no priors', () => {
    const s: TriggerState = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx,
    });
    expect(s.status).toBe('awaiting_consent');
  });

  it('stays idle for Surprise Me destination string', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Surprise Me', ...defaultCtx,
    });
    expect(s.status).toBe('idle');
  });

  it('stays idle when isSurpriseMe flag is true even with non-Surprise-Me destination', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx, isSurpriseMe: true,
    });
    expect(s.status).toBe('idle');
  });

  it('stays idle when items already exist', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx, hasItems: true,
    });
    expect(s.status).toBe('idle');
  });

  it('stays idle when destination is empty', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: '', ...defaultCtx,
    });
    expect(s.status).toBe('idle');
  });

  it('stays idle for returning user (hasPriorMessages=true)', () => {
    const s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx, hasPriorMessages: true,
    });
    expect(s.status).toBe('idle');
  });

  it('moves awaiting_consent → consented → searching → done', () => {
    let s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx,
    });
    s = triggerReducer(s, { type: 'userConsent' });
    expect(s.status).toBe('consented');
    s = triggerReducer(s, { type: 'searchStarted' });
    expect(s.status).toBe('searching');
    s = triggerReducer(s, { type: 'searchFinished' });
    expect(s.status).toBe('done');
  });

  it('declines cleanly without firing a search', () => {
    let s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx,
    });
    s = triggerReducer(s, { type: 'userDecline' });
    expect(s.status).toBe('declined');
  });

  it('resets on enterTripContext for a new trip', () => {
    let s = triggerReducer(initialTriggerState, {
      type: 'enterTripContext', tripId: 1, destination: 'Cancún', ...defaultCtx,
    });
    s = triggerReducer(s, { type: 'userDecline' });
    s = triggerReducer(s, {
      type: 'enterTripContext', tripId: 2, destination: 'Tokyo', ...defaultCtx,
    });
    expect(s.status).toBe('awaiting_consent');
    expect(s.tripId).toBe(2);
  });
});

describe('nudgeReducer', () => {
  it('emits a nudge after 30s of no interaction on a stalled section', () => {
    let s: NudgeState = nudgeReducer(initialNudgeState, {
      type: 'setSection', section: 'explore-no-vibes', now: 0,
    });
    s = nudgeReducer(s, { type: 'tick', now: 31000 });
    expect(s.pendingNudge).toBe('explore-no-vibes');
  });

  it('does not emit twice for the same section in a session', () => {
    let s = nudgeReducer(initialNudgeState, {
      type: 'setSection', section: 'explore-no-vibes', now: 0,
    });
    s = nudgeReducer(s, { type: 'tick', now: 31000 });
    s = nudgeReducer(s, { type: 'consumeNudge' });
    s = nudgeReducer(s, { type: 'tick', now: 62000 });
    expect(s.pendingNudge).toBeNull();
  });

  it('resets idle timer on interaction', () => {
    let s = nudgeReducer(initialNudgeState, {
      type: 'setSection', section: 'flight-no-origin', now: 0,
    });
    s = nudgeReducer(s, { type: 'interaction', now: 20000 });
    s = nudgeReducer(s, { type: 'tick', now: 40000 });
    expect(s.pendingNudge).toBeNull();
    s = nudgeReducer(s, { type: 'tick', now: 51000 });
    expect(s.pendingNudge).toBe('flight-no-origin');
  });

  it('never emits for section=complete', () => {
    let s = nudgeReducer(initialNudgeState, {
      type: 'setSection', section: 'complete', now: 0,
    });
    s = nudgeReducer(s, { type: 'tick', now: 60000 });
    expect(s.pendingNudge).toBeNull();
  });
});
