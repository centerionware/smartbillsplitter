import React, { useState } from 'react';

interface InfoItem {
  id: string;
  key: string;
  value: string;
}

interface AdditionalInfoEditorProps {
  initialInfo: InfoItem[];
  onSave: (info: InfoItem[]) => void;
  onCancel: () => void;
}

const AdditionalInfoEditor: React.FC<AdditionalInfoEditorProps> = ({ initialInfo, onSave, onCancel }) => {
  const [info, setInfo] = useState<InfoItem[]>(() => JSON.parse(JSON.stringify(initialInfo)));

  const handleInfoChange = (id: string, field: 'key' | 'value', value: string) => {
    setInfo(currentInfo =>
      currentInfo.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddItem = () => {
    const newItem: InfoItem = { id: `info-manual-${Date.now()}`, key: '', value: '' };
    setInfo(currentInfo => [...currentInfo, newItem]);
  };

  const handleDeleteItem = (id: string) => {
    setInfo(currentInfo => currentInfo.filter(item => item.id !== id));
  };

  const handleSave = () => {
    const finalInfo = info.filter(item => item.key.trim() !== '' || item.value.trim() !== '');
    onSave(finalInfo);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 z-50 flex justify-center items-center p-4" role="dialog" aria-modal="true" aria-labelledby="info-editor-title">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 id="info-editor-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Edit Additional Information</h2>
        </div>

        <div className="p-6 flex-grow overflow-y-auto">
          {info.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400">No additional details yet. Add one to get started.</p>
          ) : (
            <ul className="space-y-4">
              {info.map((item) => (
                <li key={item.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex items-center gap-3">
                  <div className="flex-grow space-y-2">
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => handleInfoChange(item.id, 'key', e.target.value)}
                      placeholder="Key (e.g., Store Address)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                    />
                    <textarea
                      value={item.value}
                      onChange={(e) => handleInfoChange(item.id, 'value', e.target.value)}
                      placeholder="Value (e.g., 123 Main St)"
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full flex-shrink-0 self-start"
                    aria-label={`Delete item ${item.key}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6">
            <button
              onClick={handleAddItem}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              <span>Add Detail</span>
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end items-center">
          <div className="flex space-x-4">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdditionalInfoEditor;