export type Theme = 'light' | 'dark';

export const THEME_KEY = 'fontwars:theme:v1';

export function readSavedTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function saveTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Keep the selected theme active for this page when storage is unavailable.
  }
}

export function applySavedTheme(): void {
  applyTheme(readSavedTheme());
}
