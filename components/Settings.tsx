import React from 'react';
import type { SettingsSection } from '../types';

interface SettingsProps {
  onNavigateToSection: (section: SettingsSection) => void;
  onBack: () => void;
  canInstall: boolean;
  promptInstall: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onNavigateToSection, onBack, canInstall, promptInstall }) => {

  const sections: { id: SettingsSection; title: string; description: string; icon: string; }[] = [
    { id: 'personalization', title: 'Personalization', description: 'Name, theme, and share message', icon: '🎨' },
    { id: 'payments', title: 'Payment Methods', description: 'Your Venmo, PayPal, etc.', icon: '💳' },
    { id: 'reminders', title: 'Bill Reminders', description: 'Get notifications for due bills', icon: '🔔' },
    { id: 'subscription', title: 'Subscription', description: 'Manage your Pro subscription', icon: '⭐' },
    { id: 'data', title: 'Data & Tools', description: 'Import, export, or scan QR', icon: '🛠️' },
    { id: 'sync', title: 'Sync Devices', description: 'Transfer data to another device', icon: '🔄' },
    { id: 'about', title: 'About & Support', description: 'Project source, issues, and changelog', icon: 'ℹ️' },
    { id: 'disclaimer', title: 'Disclaimer & Privacy', description: 'How your data is handled', icon: '⚖️' },
    { id: 'danger', title: 'Danger Zone', description: 'Reset all application data', icon: '🔥' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        Back
      </button>

      <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Settings</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => onNavigateToSection(section.id)}
            className="relative p-6 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:shadow-xl dark:hover:shadow-teal-900/40 text-left transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="text-4xl mb-4">{section.icon}</div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{section.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{section.description}</p>
          </button>
        ))}
        {canInstall && (
          <button
            onClick={promptInstall}
            className="relative p-6 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:shadow-xl dark:hover:shadow-teal-900/40 text-left transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="text-4xl mb-4">📥</div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Install App</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Install to your device for an offline, native app experience.</p>
          </button>
        )}
      </div>
    </div>
  );
};

export default Settings;