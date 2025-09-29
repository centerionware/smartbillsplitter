import React, { useState, useEffect, useRef, memo } from 'react';

// --- Types ---
type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';
type ConsoleMode = 'console' | 'network';
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
        return JSON.stringify(data);
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
                <pre className="text-amber-300 ml-6 bg-slate-800 p-1 rounded-md text-xs">{renderValue()}</pre>
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


const DebugConsole: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [networkLogs, setNetworkLogs] = useState<NetworkLogEntry[]>([]);
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
            setLogs(prev => [...prev, { id: Date.now() + Math.random(), level, timestamp: now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), args }]);
        };
        
        window.fetch = async (...args: [RequestInfo | URL, RequestInit?]) => {
            // FIX: Correctly construct the Request object. The original code used a spread operator on `args[0]`, which is not iterable.
            const request = new Request(args[0], args[1]);
            const now = new Date();
            let requestBody: any = null;
            try {
                if (request.method !== 'GET' && request.method !== 'HEAD') {
                    requestBody = await request.clone().json();
                }
            } catch {
                try {
                    requestBody = await request.clone().text();
                } catch {
                    requestBody = '[Could not read body]';
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
                    responseBody = await response.clone().json();
                } catch {
                    try {
                        responseBody = await response.clone().text();
                    } catch {
                        responseBody = '[Could not read response body]';
                    }
                }
                setNetworkLogs(prev => prev.map(log => log.id === logEntry.id ? { ...log, status: response.status, ok: response.ok, responseHeaders, responseBody } : log));
                return response;
            } catch (error) {
                setNetworkLogs(prev => prev.map(log => log.id === logEntry.id ? { ...log, status: 0, ok: false } : log));
                throw error;
            }
        };

        console.log = captureLog('log');
        console.warn = captureLog('warn');
        console.error = captureLog('error');
        console.info = captureLog('info');
        console.debug = captureLog('debug');

        return () => {
            Object.assign(console, originalConsole);
            window.fetch = originalFetch;
        };
    }, []);
    
    useEffect(() => {
        if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }, [logs, networkLogs, mode]);
    
    return (
        <div 
            className={`fixed bottom-0 left-0 right-0 bg-slate-900/90 dark:bg-black/90 backdrop-blur-sm text-white font-mono text-sm z-[100] transition-all duration-300 ease-in-out`}
            style={{ height: isExpanded ? '50vh' : '10vh' }}
        >
            <div className="flex flex-col h-full">
                <DebugHeader
                    mode={mode}
                    setMode={setMode}
                    onClear={() => mode === 'console' ? setLogs([]) : setNetworkLogs([])}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setIsExpanded(!isExpanded)}
                />
                <div ref={logContainerRef} className="flex-grow p-2 overflow-y-auto">
                    {mode === 'console' ? (
                        <ConsoleView logs={logs} onExploreObject={setExploringObject} />
                    ) : (
                        <NetworkView networkLogs={networkLogs} onSelectLog={setSelectedLog} />
                    )}
                </div>
            </div>
            {exploringObject && <ObjectExplorer data={exploringObject} onClose={() => setExploringObject(null)} />}
        </div>
    );
};

export default DebugConsole;
