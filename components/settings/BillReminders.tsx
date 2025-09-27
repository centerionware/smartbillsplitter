import React from 'react';

interface BillRemindersProps {
    notificationsEnabled: boolean;
    notificationDays: number;
    onToggleNotifications: (enabled: boolean) => void;
    onDaysChange: (days: number) => void;
    isNotificationSupported: boolean;
    notificationPermission: NotificationPermission;
}

const BillReminders: React.FC<BillRemindersProps> = ({
    notificationsEnabled,
    notificationDays,
    onToggleNotifications,
    onDaysChange,
    isNotificationSupported,
    notificationPermission
}) => {
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Bill Reminders</h3>
            {!isNotificationSupported ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 rounded-r-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        Your browser does not support scheduled notifications. This feature is currently available on browsers like Chrome and Edge.
                    </p>
                </div>
            ) : (
                <>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div>
                          <h4 className="font-semibold text-slate-700 dark:text-slate-200">Enable Bill Reminders</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Get a notification before a recurring bill is due.</p>
                      </div>
                      <button
                          type="button"
                          onClick={() => onToggleNotifications(!notificationsEnabled)}
                          disabled={notificationPermission === 'denied'}
                          className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed ${notificationsEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                  </div>
                  {notificationPermission === 'denied' && (
                       <p className="text-sm text-red-600 dark:text-red-400">
                           Notification permission has been denied. You need to enable it in your browser's site settings to use this feature.
                       </p>
                  )}
                  {notificationsEnabled && notificationPermission === 'granted' && (
                      <div>
                          <label htmlFor="notificationDays" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Notify me</label>
                          <div className="flex items-center gap-2">
                              <input
                                id="notificationDays"
                                type="number"
                                min="1"
                                max="30"
                                value={notificationDays}
                                onChange={(e) => onDaysChange(parseInt(e.target.value, 10) || 1)}
                                className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                              />
                              <span className="text-slate-700 dark:text-slate-200">day(s) before a bill is due.</span>
                          </div>
                      </div>
                  )}
                </>
            )}
        </div>
    );
};

export default BillReminders;
