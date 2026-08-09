'use client';

// Theme switcher with system-setting support.

import { useCallback, useState } from 'react';

export type Theme = 'light' | 'dark';

/** Reads the stored or system preference. Returns 'dark' during SSR-safe fallback. */
function preferredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * The inline script in `layout.tsx` sets `data-theme` before first paint, so the
 * attribute is already correct by the time React hydrates. Reading it in a lazy
 * initialiser therefore needs no effect and produces no flash of the wrong theme.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined'
      ? 'dark'
      : ((document.documentElement.dataset.theme as Theme | undefined) ?? preferredTheme())
  );

  const toggleTheme = useCallback(() => {
    setTheme(current => {
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
