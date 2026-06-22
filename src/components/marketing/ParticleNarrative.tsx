'use client';

import { useEffect } from 'react';
import { initParticleNarrative } from './particle-narrative';

/**
 * Drives the home-page scroll-scrubbed particle canvas (`#px`) injected by the
 * marketing partial. Runs the animation on mount and tears it down on unmount,
 * so navigating away and back to `/` re-initializes against the fresh canvas
 * instead of leaving a dead one. Renders nothing itself.
 */
export function ParticleNarrative() {
  useEffect(() => {
    // initParticleNarrative returns its own teardown (cancels rAF + listeners).
    const teardown = initParticleNarrative();
    return teardown;
  }, []);
  return null;
}
