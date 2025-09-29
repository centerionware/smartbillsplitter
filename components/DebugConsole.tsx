import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { getAllStoreData, getCommunicationKeyPair } from '../services/db';
import { verify } from '../services/cryptoService';

// --- Types ---
type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';
type ConsoleMode = 'console' | 'network' | 'broadcast' | 'database';
type DetailView = 'requestHeaders' | 'responseHeaders' | 'requestBody' | 'responseBody';

interface LogEntry {
  id: number;
  level: LogLevel;
  timestamp: string;
  args: any[];
}

interface NetworkLogEntry {
  id: number;
  url: string;
  method: string;
  status: number | null;
  ok: boolean | null;
  timestamp: string;
  requestHeaders: Record<string, string>;
  requestBody: any;
  responseHeaders: Record<string, string>;
  responseBody: any;
}

interface SignedBroadcastLogEntry {
  id: number;
  timestamp: string;
  data: any; // The raw event.data
}


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
        case 'string': return value.length * 2; // Rough estimate for UTF-16
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


const formatArg = (arg: any, onExplore: (obj: any) => void): React.ReactNode => {
    if (typeof arg === 'object' && arg !== null) {
        return (
            <button
                onClick={() => onExplore(arg)}
                className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-md text-cyan-400 font-semibold text-left"
            >
                {arg.constructor?.name || 'Object'}
            </button>
        );
    }
    if (arg === undefined) return <span className="text-slate-500">undefined</span>;
    if (arg === null) return <span className="text-purple-400">null</span>;
    if (typeof arg === 'string') return <span className="text-amber-300">"{arg}"</span>;
    if (typeof arg === 'number') return <span className="text-lime-400">{arg}</span>;
    if (typeof arg === 'boolean') return <span className="text-purple-400">{String(arg)}</span>;

    return String(arg);
};

const getLevelStyles = (level: LogLevel) => {
    switch (level) {
        case 'error': return 'text-red-400 border-l-2 border-red-500';
        case 'warn': return 'text-yellow-400 border-l-2 border-yellow-500';
        case 'info': return 'text-blue-400 border-l-2 border-blue-400';
        default: return 'text-slate-300 border-l-2 border-transparent';
    }
};

// --- Sub-Components ---

const DebugHeader: React.FC<{
    mode: ConsoleMode;
    setMode: (mode: ConsoleMode) => void;
    onClear: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}> = ({ mode, setMode, onClear, isExpanded, onToggleExpand }) => (
    <header className="flex-shrink-0 flex justify-between items-center p-2 bg-slate-800/80 dark:bg-slate-900/80 border-b border-slate-700">
        <div className="flex items-center space-x-1 bg-slate-700 p-1 rounded-lg">
            <button onClick={() => setMode('console')} className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${mode === 'console' ? 'bg-slate-800 shadow text-teal-400' : 'text-slate-300'}`}>Console</button>
            <button onClick={() => setMode('network')} className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${mode === 'network' ? 'bg-slate-800 shadow text-teal-400' : 'text-slate-300'}`}>Network</button>
            <button onClick={() => setMode('broadcast')} className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${mode === 'broadcast' ? 'bg-slate-800 shadow text-teal-400' : 'text-slate-300'}`}>Broadcast</button>
            <button onClick={() => setMode('database')} className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${mode === 'database' ? 'bg-slate-800 shadow text-teal-400' : 'text-slate-300'}`}>Database</button>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={onClear} title="Clear" className="hover:text-teal-400 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <button onClick={onToggleExpand} title={isExpanded ? 'Collapse' : 'Expand'} className="hover:text-teal-400 p-1">
                {isExpanded ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>}
            </button>
        </div>
    </header>
);

const ConsoleView: React.FC<{ logs: LogEntry[], onExploreObject: (obj: any) => void }> = ({ logs, onExploreObject }) => (
    <>
        {logs.map(log => (
            <div key={log.id} className={`flex gap-3 py-1 px-2 items-start ${getLevelStyles(log.level)}`}>
                <span className="text-slate-500 flex-shrink-0">{log.timestamp}</span>
                <div className="flex-grow flex flex-wrap gap-2">{log.args.map((arg, i) => <div key={i}>{formatArg(arg, onExploreObject)}</div>)}</div>
            </div>
        ))}
    </>
);

const NetworkView: React.FC<{ networkLogs: NetworkLogEntry[], onSelectLog: (log: NetworkLogEntry) => void }> = ({ networkLogs, onSelectLog }) => (
    <>
        {networkLogs.map(log => {
            const statusColor = log.ok === null ? 'text-slate-400' : log.ok ? 'text-emerald-400' : 'text-red-400';
            const urlPath = log.url.split('?')[0].split('/').pop() || log.url;
            const truncatedUrl = urlPath.length > 35 ? `...${urlPath.slice(-32)}` : urlPath;
            const statusIcon = log.ok === null ? '⏳' : log.ok ? '🟢' : '🚫';
            return (
                <div key={log.id} onClick={() => onSelectLog(log)} className="flex gap-3 py-1 px-2 items-center border-b border-slate-800 hover:bg-slate-700/50 cursor-pointer">
                    <span title={log.ok === false ? 'Request Failed' : 'Success'}>{statusIcon}</span>
                    <span className={`font-bold w-12 text-center ${statusColor}`}>{log.status === 0 ? 'FAIL' : (log.status || '...')}</span>
                    <span className="font-semibold text-sky-400 w-16 text-center">{log.method}</span>
                    <span className="flex-grow text-slate-300" title={log.url}>{truncatedUrl}</span>
                    <span className="text-slate-500 flex-shrink-0">{log.timestamp}</span>
                </div>
            );
        })}
    </>
);

const ObjectNode: React.FC<{ data: any; name: string; path: string }> = memo(({ data, name, path }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isValueVisible, setIsValueVisible] = useState(false);

    const isExpandable = typeof data === 'object' && data !== null && Object.keys(data).length > 0;
    const valueType = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
    const valueSize = calculateSize(data);

    const renderValue = () => {
        if (isExpandable) return null; // Value is shown by expanding
        if (typeof data === 'string' && data.length > 200) return `"${data.substring(0, 200)}..."`;
        return JSON.stringify(data, getCircularReplacer(), 2);
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
                    {Object.entries(data).map(([key, value]) => (
                        <ObjectNode key={`${path}.${key}`} data={value} name={key} path={`${path}.${key}`} />
                    ))}
                </div>
            )}
        </div>
    );
});


const ObjectExplorer: React.FC<{ data: any; onClose: () => void }> = ({ data, onClose }) => (
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

const NetworkDetailView: React.FC<{ 
    log: NetworkLogEntry, 
    onBack: () => void,
    onExploreObject: (obj: any) => void
}> = ({ log, onBack, onExploreObject }) => {
    const [detailView, setDetailView] = useState<DetailView>('responseBody');

    const renderBody = (body: any) => {
        if (body === null || body === undefined) return <span className="text-slate-500">Empty</span>;
        if (typeof body === 'string' && body.startsWith('[')) {
             try {
                const parsed = JSON.parse(body);
                return <ObjectNode data={parsed} name="(root)" path="root" />;
            } catch (e) {
                return <pre className="whitespace-pre-wrap break-all">{body}</pre>;
            }
        }
        if (typeof body === 'object') {
            return <ObjectNode data={body} name="(root)" path="root" />;
        }
        return <pre className="whitespace-pre-wrap break-all">{String(body)}</pre>;
    };
    
    const renderHeaders = (headers: Record<string, string>) => {
        if (Object.keys(headers).length === 0) return <span className="text-slate-500">No Headers</span>;
        return (
            <div className="space-y-1">
                {Object.entries(headers).map(([key, value]) => (
                    <div key={key} className="flex">
                        <span className="text-purple-400 w-48 flex-shrink-0">{key}:</span>
                        <span className="text-slate-300 break-all">{value}</span>
                    </div>
                ))}
            </div>
        );
    };

    const tabClasses = (tab: DetailView) => 
        `px-3 py-1 text-xs font-semibold rounded-md transition-colors ${detailView === tab ? 'bg-slate-800 shadow text-teal-400' : 'text-slate-300'}`;

    return (
        <div className="p-2">
            <button onClick={onBack} className="flex items-center gap-2 mb-4 text-teal-400 font-semibold">
                &larr; Back to Network List
            </button>
            <div className="p-2 bg-slate-800 rounded-lg">
                <p className="font-bold break-all">{log.method} {log.url}</p>
                <p className={`font-bold ${log.ok ? 'text-emerald-400' : 'text-red-400'}`}>Status: {log.status}</p>
            </div>

            <div className="my-4 flex items-center space-x-1 bg-slate-700 p-1 rounded-lg self-start">
                <button onClick={() => setDetailView('responseBody')} className={tabClasses('responseBody')}>Response Body</button>
                <button onClick={() => setDetailView('requestBody')} className={tabClasses('requestBody')}>Request Body</button>
                <button onClick={() => setDetailView('responseHeaders')} className={tabClasses('responseHeaders')}>Response Headers</button>
                <button onClick={() => setDetailView('requestHeaders')} className={tabClasses('requestHeaders')}>Request Headers</button>
            </div>
            
            <div className="p-2 bg-slate-800/50 rounded-lg overflow-x-auto">
                {detailView === 'responseBody' && renderBody(log.responseBody)}
                {detailView === 'requestBody' && renderBody(log.requestBody)}
                {detailView === 'responseHeaders' && renderHeaders(log.responseHeaders)}
                {detailView === 'requestHeaders' && renderHeaders(log.requestHeaders)}
            </div>
        </div>
    );
};

const BroadcastLogEntry: React.FC<{ log: SignedBroadcastLogEntry }> = ({ log }) => {
    const [verificationResult, setVerificationResult] = useState<any>('Verifying...');

    useEffect(() => {
        const verifyLog = async () => {
            const signedMessage = log.data;
            if (!signedMessage || typeof signedMessage.payload !== 'object' || typeof signedMessage.signature !== 'string') {
                setVerificationResult({ error: "Malformed or unsigned message." });
                return;
            }
            try {
                const keyPair = await getCommunicationKeyPair();
                if (!keyPair?.publicKey) {
                    setVerificationResult({ error: "Public key not found." });
                    return;
                }
                const payloadString = JSON.stringify(signedMessage.payload);
                const isVerified = await verify(payloadString, signedMessage.signature, keyPair.publicKey);
                if (isVerified) {
                    setVerificationResult(signedMessage.payload);
                } else {
                    setVerificationResult({ error: "INVALID SIGNATURE" });
                }
            } catch (e: any) {
                setVerificationResult({ error: e.message });
            }
        };
        verifyLog();
    }, [log]);

    return (
        <div className="grid md:grid-cols-2 gap-4 border-t border-slate-700 py-2">
            <div>
                <h4 className="font-bold text-slate-400 mb-2">Raw Signed Message</h4>
                <div className="bg-slate-800 p-2 rounded-md"><ObjectNode data={log.data} name="(root)" path={`raw-${log.id}`} /></div>
            </div>
            <div>
                <h4 className="font-bold text-slate-400 mb-2">Verification Result</h4>
                <div className="bg-slate-800 p-2 rounded-md"><ObjectNode data={verificationResult} name="(root)" path={`verified-${log.id}`} /></div>
            </div>
        </div>
    );
};

const BroadcastView: React.FC<{ logs: SignedBroadcastLogEntry[] }> = ({ logs }) => (
    <div className="space-y-2">
        {logs.map(log => (
             <div key={log.id} className="flex gap-3 items-start">
                <span className="text-slate-500 flex-shrink-0">{log.timestamp}</span>
                <div className="flex-grow"><BroadcastLogEntry log={log} /></div>
            </div>
        ))}
    </div>
);

const DatabaseView: React.FC<{ onExploreObject: (obj: any) => void }> = ({ onExploreObject }) => {
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
            } else if (selectedStore && !data[selectedStore]) {
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
                {dbData && Object.keys(dbData).map(storeName => (
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

const DebugConsole: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [networkLogs, setNetworkLogs] = useState<NetworkLogEntry[]>([]);
    const [broadcastLogs, setBroadcastLogs] = useState<SignedBroadcastLogEntry[]>([]);
    const [mode, setMode] = useState<ConsoleMode>('console');
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedLog, setSelectedLog] = useState<NetworkLogEntry | null>(null);
    const [exploringObject, setExploringObject] = useState<any>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const originalConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
        const originalFetch = window.fetch;

        const captureLog = (level: LogLevel) => (...args: any[]) => {
            originalConsole[level](...args);
            const now = new Date();
            setLogs(prev => [...prev, { id: Date.now() + Math.random(), level, timestamp: now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), args: [...args] }]);
        };
        
       window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const request = new Request(input, init);
            const now = new Date();
            let requestBody: any = null;
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                try {
                    const clonedRequest = request.clone();
                    try {
                        requestBody = await clonedRequest.json();
                    } catch {
                        requestBody = await clonedRequest.text();
                    }
                } catch {
                    requestBody = '[Body already read or could not be cloned]';
                }
            }
            const requestHeaders: Record<string, string> = {};
            request.headers.forEach((value, key) => { requestHeaders[key] = value; });

            const logEntry: NetworkLogEntry = {
                id: Date.now() + Math.random(),
                url: request.url,
                method: request.method,
                status: null, ok: null,
                timestamp: now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                requestHeaders, requestBody, responseHeaders: {}, responseBody: null,
            };
            setNetworkLogs(prev => [...prev, logEntry]);

            try {
                const response = await originalFetch(request);
                let responseBody: any = null;
                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => { responseHeaders[key] = value; });
                
                try {
                    const clonedResponse = response.clone();
                    const text = await clonedResponse.text();
                    if (text) {
                        try {
                            responseBody = JSON.parse(text);
                        } catch {
                            responseBody = text;
                        }
                    } else {
                        responseBody = '[Empty Response Body]';
                    }
                } catch (e: any) {
                    responseBody = `[Could not read response body: ${e.message}]`;
                }

                setNetworkLogs(prev => prev.map(log => log.id === logEntry.id ? { ...log, status: response.status, ok: response.ok, responseHeaders, responseBody } : log));
                return response;
            } catch (error) {
                setNetworkLogs(prev => prev.map(log => log.id === logEntry.id ? { ...log, status: 0, ok: false, responseBody: String(error) } : log));
                throw error;
            }
        };

        const captureChannel = new BroadcastChannel('smart-bill-splitter-sync');
        const handleRawMessage = (event: MessageEvent<any>) => {
            const now = new Date();
            setBroadcastLogs(prev => [...prev, {
                id: Date.now() + Math.random(),
                timestamp: now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                data: event.data
            }]);
        };
        captureChannel.addEventListener('message', handleRawMessage);

        console.log = captureLog('log');
        console.warn = captureLog('warn');
        console.error = captureLog('error');
        console.info = captureLog('info');
        console.debug = captureLog('debug');

        return () => {
            Object.assign(console, originalConsole);
            window.fetch = originalFetch;
            captureChannel.removeEventListener('message', handleRawMessage);
            captureChannel.close();
        };
    }, []);
    
    useEffect(() => {
        if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }, [logs, networkLogs, broadcastLogs, mode, selectedLog]);
    
    const handleClear = () => {
        switch (mode) {
            case 'console': setLogs([]); break;
            case 'network': setNetworkLogs([]); setSelectedLog(null); break;
            case 'broadcast': setBroadcastLogs([]); break;
            case 'database': /* DB view has its own refresh */ break;
        }
    };

    const renderCurrentView = () => {
        switch (mode) {
            case 'console': return <ConsoleView logs={logs} onExploreObject={setExploringObject} />;
            case 'network': return selectedLog ? (
                 <NetworkDetailView 
                    log={selectedLog} 
                    onBack={() => setSelectedLog(null)}
                    onExploreObject={setExploringObject} 
                />
            ) : (
                <NetworkView networkLogs={networkLogs} onSelectLog={setSelectedLog} />
            );
            case 'broadcast': return <BroadcastView logs={broadcastLogs} />;
            case 'database': return <DatabaseView onExploreObject={setExploringObject} />;
            default: return null;
        }
    };

    return (
        <div 
            className={`fixed bottom-0 left-0 right-0 bg-slate-900/90 dark:bg-black/90 backdrop-blur-sm text-white font-mono text-sm z-[100] transition-all duration-300 ease-in-out`}
            style={{ height: isExpanded ? '80vh' : '10vh' }}
        >
            <div className="flex flex-col h-full">
                <DebugHeader
                    mode={mode}
                    setMode={(newMode) => {
                        setMode(newMode);
                        setSelectedLog(null);
                    }}
                    onClear={handleClear}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setIsExpanded(!isExpanded)}
                />
                <div ref={logContainerRef} className="flex-grow p-2 overflow-auto">
                   {renderCurrentView()}
                </div>
            </div>
            {exploringObject && <ObjectExplorer data={exploringObject} onClose={() => setExploringObject(null)} />}
        </div>
    );
};

export default DebugConsole;
