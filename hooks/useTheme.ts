import { useState, useEffect, useCallback } from 'react';
import type { Theme } from '../types.ts';
import { getTheme, saveTheme } from '../services/db.ts';

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isLoading, setIsLoading] = useState(true);

  const applyTheme = useCallback((themeToApply: Theme) => {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    const isDark =
      themeToApply === 'dark' ||
      (themeToApply === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
        
    root.classList.toggle('dark', isDark);
  }, []);

  // Effect to load initial theme from DB
  useEffect(() => {
    const loadTheme = async () => {
      setIsLoading(true);
      const dbTheme = await getTheme() || 'system';
      setThemeState(dbTheme);
      applyTheme(dbTheme);
      setIsLoading(false);
    };
    loadTheme();
  }, [applyTheme]);

  // Effect to listen for system theme changes
  useEffect(() => {
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = async () => {
      const currentTheme = await getTheme();
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };

    systemThemeQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [applyTheme]);

  const setTheme = async (newTheme: Theme) => {
    await saveTheme(newTheme);
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  return { theme, setTheme, isLoading };
};
