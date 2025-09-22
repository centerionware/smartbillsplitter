import { useState, useEffect, useCallback } from 'react';
import type { Theme } from '../types';

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'system';
    }
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  const applyTheme = useCallback((themeToApply: Theme) => {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    const isDark =
      themeToApply === 'dark' ||
      (themeToApply === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
        
    root.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    // This effect runs only once to set up the system theme listener.
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = () => {
      // The listener checks localStorage directly to decide if it should act.
      if ((localStorage.getItem('theme') || 'system') === 'system') {
        applyTheme('system');
      }
    };

    systemThemeQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [applyTheme]); // Depends on applyTheme, which is stable.

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  return { theme, setTheme };
};