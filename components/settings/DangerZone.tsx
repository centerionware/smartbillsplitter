import React from 'react';

interface DangerZoneProps {
    onResetApp: () => void;
}

const DangerZone: React.FC<DangerZoneProps> = ({ onResetApp }) => {
    return (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
          <div className="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-r-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <span className="font-bold">Warning:</span> The action below is irreversible and will delete all your bills and settings. Proceed with caution.
            </p>
          </div>
          <div>
            <button 
              onClick={onResetApp} 
              className="w-full text-center justify-center bg-red-100 text-red-800 font-semibold py-3 px-4 rounded-lg hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60 transition-colors"
            >
              Reset App to Default
            </button>
          </div>
        </div>
    );
};

export default DangerZone;
