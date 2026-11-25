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

  // Keep the browser's mobile UI chrome aligned with the active app theme.
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = theme === 'dark' ? '#151c2c' : '#fffdf7';
  }
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
