import React from 'react';
import type { Theme } from '../types.ts';

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme }) => {
  const options: { name: Theme; icon: JSX.Element; title: string }[] = [
    {
      name: 'light',
      title: 'Light Mode',
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
    {
      name: 'dark',
      title: 'Dark Mode',
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
    },
    {
      name: 'system',
      title: 'System Default',
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    },
  ];

  return (
    <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
      {options.map(opt => (
        <button
          key={opt.name}
          onClick={() => setTheme(opt.name)}
          className={`p-2 rounded-md transition-colors duration-200 ${
            theme === opt.name
              ? 'bg-white dark:bg-slate-900 text-teal-500 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
          aria-label={`Set theme to ${opt.name}`}
          title={opt.title}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;