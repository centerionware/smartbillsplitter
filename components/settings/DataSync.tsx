import React from 'react';

interface DataSyncProps {
  onNavigate: () => void;
}

const DataSync: React.FC<DataSyncProps> = ({ onNavigate }) => {
  
  return (
    <div>
      <p className="text-slate-600 dark:text-slate-300 mb-6">
        This feature allows you to securely transfer all your app data (bills, settings, etc.) from one device to another using a temporary, end-to-end encrypted connection.
      </p>
      
      <button
        onClick={onNavigate}
        className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
      >
        Start Sync
      </button>
    </div>
  );
};

export default DataSync;