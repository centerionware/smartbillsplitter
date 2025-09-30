import React, { useState, useEffect, useCallback } from 'react';
import { getAllStoreData } from '../../../services/db';
import { ObjectNode } from '../common/ObjectExplorer';

export const DatabaseView: React.FC = () => {
    const [dbData, setDbData] = useState<Record<string, any[]> | null>(null);
    const [selectedStore, setSelectedStore] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDb = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getAllStoreData();
            setDbData(data);
            if (!selectedStore && data && Object.keys(data).length > 0) {
                setSelectedStore(Object.keys(data)[0]);
            } else if (selectedStore && data && !data[selectedStore]) {
                 setSelectedStore(Object.keys(data)[0] || null);
            }
        } catch (e: any) {
            setError(e.message || 'Failed to load database.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedStore]);

    useEffect(() => {
        loadDb();
    }, []); // Load once on mount

    return (
        <div className="flex h-full">
            <div className="w-1/3 border-r border-slate-700 p-2 overflow-y-auto">
                <button onClick={loadDb} disabled={isLoading} className="w-full mb-2 p-2 bg-slate-700 hover:bg-slate-600 rounded-md">
                    {isLoading ? 'Refreshing...' : 'Refresh DB'}
                </button>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                {dbData && Object.keys(dbData).sort().map(storeName => (
                    <button 
                        key={storeName} 
                        onClick={() => setSelectedStore(storeName)}
                        className={`w-full text-left p-2 rounded-md ${selectedStore === storeName ? 'bg-teal-800/50' : 'hover:bg-slate-700'}`}
                    >
                        {storeName} ({dbData[storeName].length})
                    </button>
                ))}
            </div>
            <div className="w-2/3 p-2 overflow-y-auto">
                {selectedStore && dbData && dbData[selectedStore] ? (
                     <ObjectNode data={dbData[selectedStore]} name={selectedStore} path={selectedStore} />
                ) : (
                    <p className="text-slate-500">Select a store to view its contents.</p>
                )}
            </div>
        </div>
    );
};
