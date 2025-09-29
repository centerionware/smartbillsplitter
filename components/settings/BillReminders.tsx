import React, { useState, useEffect } from 'react';
import type { Settings } from '../../types';
import * as notificationService from '../../services/notificationService';

interface BillRemindersProps {
  settings: Settings;
  onSettingsChange: (newSettings: Partial<Settings>) => void;
}

const BillReminders: React.FC<BillRemindersProps> = ({ settings, onSettingsChange }) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const isSupported = notificationService.isSupported();

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);
  
  const handleRequestPermission = async () => {
    const newPermission = await notificationService.requestPermission();
    setPermission(newPermission);
    if (newPermission === 'granted') {
        onSettingsChange({ notificationsEnabled: true });
    }
  };

  const handleToggle = () => {
    onSettingsChange({ notificationsEnabled: !settings.notificationsEnabled });
  };
  
  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ notificationDays: parseInt(e.target.value, 10) || 1 });
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-sm">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Browser Not Supported</p>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Your browser does not support scheduled notifications. Please try a modern browser like Chrome or Firefox on desktop or Android.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {permission !== 'granted' ? (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/40 rounded-lg flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-grow">
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                    {permission === 'denied' ? 'Permission Denied' : 'Enable Notifications'}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {permission === 'denied' 
                        ? 'You have blocked notifications for this app. You must enable them in your browser settings.'
                        : 'To receive bill reminders, you need to grant permission.'}
                </p>
            </div>
            {permission !== 'denied' && (
                <button onClick={handleRequestPermission} className="w-full sm:w-auto flex-shrink-0 px-4 py-2 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600">
                    Grant Permission
                </button>
            )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
            <label htmlFor="notificationsEnabled" className="font-medium text-slate-700 dark:text-slate-200">
                Enable Reminders
            </label>
            <button
              id="notificationsEnabled"
              type="button"
              onClick={handleToggle}
              className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${settings.notificationsEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>
      )}

      {settings.notificationsEnabled && permission === 'granted' && (
        <div>
            <label htmlFor="notificationDays" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Remind me
            </label>
            <div className="flex items-center gap-3">
                 <input
                    id="notificationDays"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.notificationDays}
                    onChange={handleDaysChange}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-slate-700 dark:text-slate-200">days before a bill is due.</span>
            </div>
        </div>
      )}
    </div>
  );
};

export default BillReminders;
