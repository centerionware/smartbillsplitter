import React, { useState } from 'react';

interface SetupDisplayNameModalProps {
  onSave: (name: string) => void;
  currentName: string;
}

const SetupDisplayNameModal: React.FC<SetupDisplayNameModalProps> = ({ onSave, currentName }) => {
  const [name, setName] = useState(currentName.trim().toLowerCase() === 'myself' ? '' : currentName);
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Display name cannot be empty.');
      return;
    }
    if (trimmedName.toLowerCase() === 'myself') {
      setError('Please choose a different name.');
      return;
    }
    setError('');
    onSave(trimmedName);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Welcome!</h2>
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Please set your display name. This will be used to identify you in new bills and when sharing with friends.
        </p>
        <div className="mb-4 text-left">
          <label htmlFor="displayNameSetup" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
            Your Name
          </label>
          <input
            id="displayNameSetup"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="e.g., Jane Doe"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            autoFocus
          />
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
        <button
          onClick={handleSave}
          disabled={!name.trim() || name.trim().toLowerCase() === 'myself'}
          className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
        >
          Save and Continue
        </button>
      </div>
    </div>
  );
};

export default SetupDisplayNameModal;