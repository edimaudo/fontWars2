import React, { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const THEME_KEY = 'fontwars:theme:v1';

function savedTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(savedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The selected theme remains active for this page even when storage is blocked.
    }
  }, [theme]);

  const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === 'dark'}
    >
      <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
      <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
    </button>
  );
}
