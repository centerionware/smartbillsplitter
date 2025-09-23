import React from 'react';
import type { RecurrenceRule } from '../types.ts';

interface RecurrenceSelectorProps {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
}

const FREQUENCIES: RecurrenceRule['frequency'][] = ['daily', 'weekly', 'monthly', 'yearly'];
const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const RecurrenceSelector: React.FC<RecurrenceSelectorProps> = ({ value, onChange }) => {
  const handleFrequencyChange = (frequency: RecurrenceRule['frequency']) => {
    const newRule: RecurrenceRule = { ...value, frequency };
    if (!newRule.interval) newRule.interval = 1;
    // Set sensible defaults when switching frequency
    if (frequency === 'weekly' && newRule.dayOfWeek === undefined) newRule.dayOfWeek = new Date().getDay();
    if (frequency === 'monthly' && newRule.dayOfMonth === undefined) newRule.dayOfMonth = new Date().getDate();
    onChange(newRule);
  };
  
  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const interval = Math.max(1, parseInt(e.target.value, 10) || 1);
      onChange({ ...value, interval });
  };

  const handleDayOfWeekChange = (day: number) => {
    onChange({ ...value, dayOfWeek: day });
  };

  const handleDayOfMonthChange = (day: number) => {
    const dayOfMonth = Math.max(1, Math.min(31, day));
    onChange({ ...value, dayOfMonth });
  };

  const frequencyLabel = {
      daily: 'day(s)',
      weekly: 'week(s)',
      monthly: 'month(s)',
      yearly: 'year(s)',
  }[value.frequency];

  return (
    <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/30">
      <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-200">Recurrence</h3>
      
      <div className="space-y-4">
        {/* Frequency & Interval */}
        <div>
           <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Frequency</label>
            <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                {FREQUENCIES.map(freq => (
                <button
                    key={freq}
                    type="button"
                    onClick={() => handleFrequencyChange(freq)}
                    className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors capitalize ${
                    value.frequency === freq
                        ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
                    }`}
                >
                    {freq}
                </button>
                ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
                <label htmlFor="interval" className="font-medium text-slate-600 dark:text-slate-300">Every</label>
                <input 
                    id="interval"
                    type="number"
                    min="1"
                    value={value.interval || 1}
                    onChange={handleIntervalChange}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
                <span className="text-slate-700 dark:text-slate-200">{frequencyLabel}</span>
            </div>
        </div>

        {/* Weekly Options */}
        {value.frequency === 'weekly' && (
            <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">On day</label>
            <div className="flex justify-center gap-1">
                {DAYS_OF_WEEK.map((day, index) => (
                <button
                    key={index}
                    type="button"
                    onClick={() => handleDayOfWeekChange(index)}
                    className={`w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
                    value.dayOfWeek === index
                        ? 'bg-teal-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500'
                    }`}
                >
                    {day}
                </button>
                ))}
            </div>
            </div>
        )}
        
        {/* Monthly Options */}
        {value.frequency === 'monthly' && (
            <div>
            <label htmlFor="dayOfMonth" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">On day of the month</label>
            <input
                id="dayOfMonth"
                type="number"
                min="1"
                max="31"
                value={value.dayOfMonth || ''}
                onChange={(e) => handleDayOfMonthChange(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">If a month doesn't have this day (e.g., 31st), the last day of the month will be used.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default RecurrenceSelector;