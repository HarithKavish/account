'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether this browser exposes the WebAuthn API at all.
 *
 * A `useState` + mount-effect pair for this used to work, but reads as
 * "external mutable value the component doesn't own" to the newer
 * `react-hooks/set-state-in-effect` rule, and rightly so: a plain effect
 * would set it a frame after the first paint, when the value never actually
 * changes after the page loads. `useSyncExternalStore` reads it once, and
 * needs no subscription because it never will.
 *
 * The server snapshot answers `true` -- optimistic, matching what both call
 * sites already did: neither hid its passkey UI while this was `null`
 * (pre-hydration) either, only once it resolved `false`. That server value
 * only ever narrows on the client, so there is nothing to reconcile and no
 * extra render.
 */
export function useWebAuthnSupport(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => typeof window.PublicKeyCredential !== 'undefined',
    () => true,
  );
}
