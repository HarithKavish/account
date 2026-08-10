/**
 * Single place where the platform decides which `AuthBackend` is installed.
 *
 * Phase 3 changes this file and nothing else: import `ServerAuthBackend`,
 * return it here, and the whole UI switches from demo to real authentication.
 */

import { MockAuthBackend } from './mock-backend';
import type { AuthBackend } from './types';

let instance: AuthBackend | null = null;

export function getAuthBackend(): AuthBackend {
  if (!instance) {
    instance = new MockAuthBackend();
  }
  return instance;
}
