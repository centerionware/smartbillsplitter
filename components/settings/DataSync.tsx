import React from 'react';

interface DataSyncProps {
    onGoToSync: () => void;
}

const DataSync: React.FC<DataSyncProps> = ({ onGoToSync }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Data Sync</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Securely transfer your data between devices. Your data is end-to-end encrypted on your device before being sent to our server for temporary storage. The unique decryption key is passed directly between your devices via the QR code, ensuring we can never access your information. This encrypted data is deleted from our server immediately after it's received by your other device.
            </p>
            <div>
                <button onClick={onGoToSync} className="w-full flex items-center justify-center gap-2 bg-teal-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-teal-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                    </svg>
                    <span>Sync With Another Device</span>
                </button>
            </div>
        </div>
    );
};

export default DataSync;
