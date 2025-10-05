import { useState, useEffect, useCallback } from 'react';
import type { Theme } from '../types';
import { getTheme, saveTheme } from '../services/db';
import { postMessage, useBroadcastListener } from '../services/broadcastService';

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

  const loadTheme = useCallback(async (isInitialLoad: boolean = false) => {
    if (isInitialLoad) setIsLoading(true);
    const dbTheme = await getTheme() || 'system';
    setThemeState(dbTheme);
    applyTheme(dbTheme);
    if (isInitialLoad) setIsLoading(false);
  }, [applyTheme]);

  useEffect(() => {
    loadTheme(true);
  }, [loadTheme]);

  useBroadcastListener(useCallback(message => {
      if (message.type === 'theme-updated') {
          loadTheme(false);
      }
  }, [loadTheme]));

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
    postMessage({ type: 'theme-updated' });
    // Apply theme immediately for the current tab
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  return { theme, setTheme, isLoading };
};