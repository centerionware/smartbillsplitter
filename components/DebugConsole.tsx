import React, { useState, useEffect, useRef } from 'react';

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

const formatArg = (arg: any): string => {
  if (typeof arg === 'object' && arg !== null) {
    try {
      const cache = new Set();
      return JSON.stringify(arg, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value)) return '[Circular Reference]';
          cache.add(value);
        }
        return value;
      }, 2);
    } catch (e) {
      return '[Unserializable Object]';
    }
  }
  if (arg === undefined) return 'undefined';
  return String(arg);
};

const getLevelStyles = (level: LogLevel) => {
    switch(level) {
        case 'error': return 'text-red-400 border-l-2 border-red-500';
        case 'warn': return 'text-yellow-400 border-l-2 border-yellow-500';
        case 'info': return 'text-blue-400 border-l-2 border-blue-400';
        default: return 'text-slate-300 border-l-2 border-transparent';
    }
}

const DebugConsole: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [networkLogs, setNetworkLogs] = useState<NetworkLogEntry[]>([]);
    const [mode, setMode] = useState<ConsoleMode>('console');
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedLog, setSelectedLog] = useState<NetworkLogEntry | null>(null);
    const [detailView, setDetailView] = useState<DetailView | null>(null);
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
            // FIX: Removed incorrect spread operator on `args[0]`, which is not an iterable.
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
    
    const renderLogs = () => logs.map(log => (
        <div key={log.id} className={`flex gap-3 py-1 px-2 whitespace-pre-wrap ${getLevelStyles(log.level)}`}>
            <span className="text-slate-500 flex-shrink-0">{log.timestamp}</span>
            <div className="flex-grow">{log.args.map((arg, i) => <span key={i}>{formatArg(arg)} </span>)}</div>
        </div>
    ));

    const renderNetwork = () => networkLogs.map(log => {
        const statusColor = log.ok === null ? 'text-slate-400' : log.ok ? 'text-emerald-400' : 'text-red-400';
        const urlPath = log.url.split('?')[0].split('/').pop() || log.url;
        const truncatedUrl = urlPath.length > 35 ? `...${urlPath.slice(-32)}` : urlPath;
        const statusIcon = log.ok === null ? '⏳' : log.ok ? '🟢' : '🚫';

        return (
            <div key={log.id} onClick={() => setSelectedLog(log)} className="flex gap-3 py-1 px-2 items-center border-b border-slate-800 hover:bg-slate-700/50 cursor-pointer">
                <span title={log.ok === false ? 'Request Failed' : 'Success'}>{statusIcon}</span>
                <span className={`font-bold w-12 text-center ${statusColor}`}>{log.status === 0 ? 'FAIL' : (log.status || '...')}</span>
                <span className="font-semibold text-sky-400 w-16 text-center">{log.method}</span>
                <span className="flex-grow text-slate-300" title={log.url}>{truncatedUrl}</span>
                <span className="text-slate-500 flex-shrink-0">{log.timestamp}</span>
            </div>
        );
    });
    
    const DetailCard: React.FC<{ title: string; onClick: () => void; }> = ({ title, onClick }) => (
        <div onClick={onClick} className="p-4 bg-slate-700 rounded-lg hover:bg-slate-600 cursor-pointer transition-colors">
            <h3 className="font-semibold text-slate-100">{title}</h3>
        </div>
    );
    
    const DetailViewer: React.FC<{ title: string; data: any; onClose: () => void }> = ({ title, data, onClose }) => (
        <div className="absolute inset-0 bg-slate-900/80 z-20 flex justify-center items-center" onClick={onClose}>
            <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h2 className="font-bold text-lg text-slate-100">{title}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full">&times;</button>
                </header>
                <pre className="p-4 overflow-auto text-xs">{formatArg(data)}</pre>
            </div>
        </div>
    );


    return (
        <div 
            className={`fixed bottom-0 left-0 right-0 bg-slate-900/90 dark:bg-black/90 backdrop-blur-sm text-white font-mono text-sm z-[100] transition-all duration-300 ease-in-out`}
            style={{ height: isExpanded ? '50vh' : '10vh' }}
        >
            <div className="flex flex-col h-full">
                <header className="flex-shrink-0 flex justify-between items-center p-2 bg-slate-800/80 dark:bg-slate-900/80 border-b border-slate-700">
                    <div className="flex items-center space-x-1 bg-slate-700 p-1 rounded-lg">
                        <button onClick={() => setMode('console')} className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${mode === 'console' ? 'bg-slate-800 shadow text-teal-400' : 'text-slate-300'}`}>Console</button>
                        <button onClick={() => setMode('network')} className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${mode === 'network' ? 'bg-slate-800 shadow text-teal-400' : 'text-slate-300'}`}>Network</button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => mode === 'console' ? setLogs([]) : setNetworkLogs([])} title="Clear" className="hover:text-teal-400 p-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <button onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? 'Collapse' : 'Expand'} className="hover:text-teal-400 p-1">
                            {isExpanded ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>}
                        </button>
                    </div>
                </header>
                <div ref={logContainerRef} className="flex-grow p-2 overflow-y-auto">
                    {mode === 'console' ? renderLogs() : renderNetwork()}
                </div>
            </div>
            
            {selectedLog && (
                <div className="absolute inset-0 bg-slate-900/80 z-10 flex justify-center items-center" onClick={() => setSelectedLog(null)}>
                    <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-4" onClick={e => e.stopPropagation()}>
                        <header className="flex justify-between items-start mb-4">
                            <div className="flex-grow">
                                <h2 className="font-bold text-lg text-slate-100">Request Details</h2>
                                <p className="text-xs text-slate-400 break-all">{selectedLog.method} {selectedLog.url}</p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-slate-700 rounded-full text-2xl leading-none">&times;</button>
                        </header>
                        <div className="grid grid-cols-2 gap-3">
                            <DetailCard title="Request Headers" onClick={() => setDetailView('requestHeaders')} />
                            <DetailCard title="Response Headers" onClick={() => setDetailView('responseHeaders')} />
                            <DetailCard title="Request Body" onClick={() => setDetailView('requestBody')} />
                            <DetailCard title="Response Body" onClick={() => setDetailView('responseBody')} />
                        </div>
                        {detailView && selectedLog && (
                            <DetailViewer
                                title={{
                                    requestHeaders: 'Request Headers',
                                    responseHeaders: 'Response Headers',
                                    requestBody: 'Request Body',
                                    responseBody: 'Response Body',
                                }[detailView]}
                                data={selectedLog[detailView]}
                                onClose={() => setDetailView(null)}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebugConsole;
