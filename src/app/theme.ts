import type { ThemePreference } from '../models/settings';

// Mirror of the theme choice so index.html can apply it before React loads (avoids a flash).
// IndexedDB remains the source of truth.
const THEME_CACHE_KEY = 'fwc-theme';

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'dark');
  try {
    localStorage.setItem(THEME_CACHE_KEY, pref);
  } catch {
    // Storage unavailable (e.g. private mode); the theme still applies for this session.
  }
}
