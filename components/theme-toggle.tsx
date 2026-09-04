'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

/** Shared with every harithkavish.com surface through HarithStore. */
export const THEME_KEY = 'theme';
/** What this origin used before the store existed; migrated on first read. */
export const LEGACY_THEME_KEY = 'hk.account.theme';

type HarithStore = {
  get(key: string): string | null;
  set(key: string, value: string): unknown;
  migrate(key: string, legacyKey: string): void;
  subscribe(fn: (key: string, value: string | null) => void): void;
};

declare global {
  interface Window {
    HarithStore?: HarithStore;
  }
}

/**
 * Runs before paint so the stored theme is applied without a flash. Reads the
 * ecosystem's shared value, so a theme chosen on another surface is already the
 * theme here.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = window.HarithStore
      ? window.HarithStore.get('${'theme'}')
      : localStorage.getItem('${'hk.account.theme'}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

/*
 * The document element is the single source of truth for the active theme — the
 * pre-paint script above sets it before React exists. Rather than mirroring it
 * into component state, every toggle subscribes to it as an external store, so
 * all instances (header and Settings) stay in step and server rendering has a
 * defined snapshot.
 */

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** The markup is rendered light; the client snapshot corrects it on hydration. */
function getServerSnapshot(): Theme {
  return 'light';
}

function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  const store = typeof window === 'undefined' ? undefined : window.HarithStore;
  if (store) {
    store.set(THEME_KEY, theme);
  } else {
    try {
      localStorage.setItem(`hk.${THEME_KEY}`, theme);
    } catch {
      // A blocked storage API only costs persistence, not the toggle itself.
    }
  }
  listeners.forEach((listener) => listener());
}

/* Chosen on another surface — adopt it, so the header here does not disagree
   with the one the reader just used. */
if (typeof window !== 'undefined' && window.HarithStore) {
  window.HarithStore.migrate(THEME_KEY, LEGACY_THEME_KEY);
  window.HarithStore.subscribe((key, value) => {
    if (key !== THEME_KEY) return;
    const next: Theme = value === 'dark' ? 'dark' : 'light';
    if (document.documentElement.getAttribute('data-theme') === next) return;
    document.documentElement.setAttribute('data-theme', next);
    listeners.forEach((listener) => listener());
  });
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
