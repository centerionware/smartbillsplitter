import React, { useState, memo } from 'react';

// --- Utility Functions ---
const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key: string, value: any) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular Reference]';
            seen.add(value);
        }
        return value;
    };
};

const calculateSize = (value: any): number => {
    if (value === null || value === undefined) return 4;
    switch (typeof value) {
        case 'string': return value.length * 2;
        case 'number': return 8;
        case 'boolean': return 4;
        case 'object':
            try {
                return JSON.stringify(value, getCircularReplacer()).length;
            } catch {
                return 0;
            }
        default: return 0;
    }
};

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const ObjectNode: React.FC<{ data: any; name: string; path: string }> = memo(({ data, name, path }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isValueVisible, setIsValueVisible] = useState(false);

    const isCryptoKey = (value: any): value is CryptoKey => typeof CryptoKey !== 'undefined' && value instanceof CryptoKey;
    const isCryptoKeyPair = (value: any): value is CryptoKeyPair => 
        typeof CryptoKey !== 'undefined' && 
        value &&
        value.publicKey instanceof CryptoKey && 
        value.privateKey instanceof CryptoKey;
    
    let displayData = data;
    if (isCryptoKey(data)) {
        displayData = {
            '$$typeof': 'CryptoKey',
            type: data.type,
            extractable: data.extractable,
            algorithm: data.algorithm,
            usages: data.usages,
        };
    } else if (isCryptoKeyPair(data)) {
        displayData = {
            '$$typeof': 'CryptoKeyPair',
            publicKey: data.publicKey,
            privateKey: data.privateKey,
        };
    }

    const isExpandable = typeof displayData === 'object' && displayData !== null && Object.keys(displayData).length > 0;
    const valueType = displayData === null ? 'null' : Array.isArray(displayData) ? 'array' : typeof displayData;
    const valueSize = calculateSize(displayData);

    const renderValue = () => {
        if (isExpandable) return null;
        if (typeof displayData === 'string' && displayData.length > 200) return `"${displayData.substring(0, 200)}..."`;
        return JSON.stringify(displayData, getCircularReplacer(), 2);
    };

    return (
        <div className="ml-4 pl-2 border-l border-slate-700">
            <div className="flex items-center gap-2 py-0.5">
                {isExpandable ? (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-500">{isExpanded ? '▼' : '▶'}</button>
                ) : (
                    <div className="w-4"></div>
                )}
                <span className="text-purple-400">{name}:</span>
                <span className="text-xs text-slate-500">({valueType}, {formatBytes(valueSize)})</span>
                {!isExpandable && <button onClick={() => setIsValueVisible(!isValueVisible)} className="text-cyan-400 text-xs">[view]</button>}
            </div>
            {isValueVisible && !isExpandable && (
                <pre className="text-amber-300 ml-6 bg-slate-800 p-1 rounded-md text-xs whitespace-pre-wrap break-all">{renderValue()}</pre>
            )}
            {isExpanded && isExpandable && (
                <div>
                    {Object.entries(displayData).map(([key, value]) => (
                        <ObjectNode key={`${path}.${key}`} data={value} name={key} path={`${path}.${key}`} />
                    ))}
                </div>
            )}
        </div>
    );
});

export const ObjectExplorer: React.FC<{ data: any; onClose: () => void }> = ({ data, onClose }) => (
    <div className="absolute inset-0 bg-slate-900/80 z-20 flex justify-center items-center" onClick={onClose}>
        <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <header className="flex justify-between items-center p-4 border-b border-slate-700">
                <h2 className="font-bold text-lg text-slate-100">Object Explorer</h2>
                <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full text-2xl leading-none">&times;</button>
            </header>
            <div className="p-4 overflow-auto">
                <ObjectNode data={data} name="(root)" path="root" />
            </div>
        </div>
    </div>
);
