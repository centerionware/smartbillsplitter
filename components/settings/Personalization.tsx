import React from 'react';
import type { Settings, Theme } from '../../types';

interface PersonalizationProps {
  settings: Settings;
  onSettingsChange: (newSettings: Partial<Settings>) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const themeOptions: { name: Theme; icon: React.ReactElement; title: string }[] = [
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

const Personalization: React.FC<PersonalizationProps> = ({ settings, onSettingsChange, theme, setTheme }) => {
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onSettingsChange({ [e.target.name]: e.target.value });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="myDisplayName" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Your Display Name</label>
        <input id="myDisplayName" name="myDisplayName" type="text" value={settings.myDisplayName} onChange={handleChange} placeholder="e.g., Jane Doe" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Theme</label>
        <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
            {themeOptions.map(opt => (
                <button
                    key={opt.name}
                    type="button"
                    onClick={() => setTheme(opt.name)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                    theme === opt.name
                        ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
                    }`}
                >
                    {opt.icon}
                    <span>{opt.title}</span>
                </button>
            ))}
        </div>
      </div>

      <div>
        <label htmlFor="shareTemplate" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Share Message Template</label>
        <textarea id="shareTemplate" name="shareTemplate" value={settings.shareTemplate} onChange={handleChange} rows={5} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Available placeholders: <code className="bg-slate-100 dark:bg-slate-600 rounded px-1">{'{participantName}'}</code>, <code className="bg-slate-100 dark:bg-slate-600 rounded px-1">{'{totalOwed}'}</code>, <code className="bg-slate-100 dark:bg-slate-600 rounded px-1">{'{billList}'}</code>, <code className="bg-slate-100 dark:bg-slate-600 rounded px-1">{'{paymentInfo}'}</code>, <code className="bg-slate-100 dark:bg-slate-600 rounded px-1">{'{promoText}'}</code>.
        </p>
      </div>
    </div>
  );
};

export default Personalization;
