import React, { useState, useEffect, useRef } from 'react';
import type { Theme } from '../types.ts';

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const options: { name: Theme; icon: JSX.Element; title: string }[] = [
  {
    name: 'light',
    title: 'Light',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
  {
    name: 'dark',
    title: 'Dark',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
  },
  {
    name: 'system',
    title: 'System',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
];

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentTheme = options.find(opt => opt.name === theme) || options[2];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (selectedTheme: Theme) => {
    setTheme(selectedTheme);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors"
        aria-label={`Current theme: ${currentTheme.title}. Click to change.`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {currentTheme.icon}
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-20"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="theme-menu-button"
        >
          {options.map(opt => (
            <button
              key={opt.name}
              onClick={() => handleSelect(opt.name)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left ${
                theme === opt.name
                  ? 'bg-teal-50 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              role="menuitem"
            >
              {opt.icon}
              <span>{opt.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;