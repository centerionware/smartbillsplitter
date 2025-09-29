import React, { useState, useEffect, useRef } from 'react';

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface LogEntry {
  id: number;
  level: LogLevel;
  timestamp: string;
  args: any[];
}

const formatArg = (arg: any): string => {
  if (typeof arg === 'object' && arg !== null) {
    try {
      // Use a replacer to handle circular references gracefully
      const cache = new Set();
      return JSON.stringify(arg, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value)) {
            return '[Circular Reference]';
          }
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
    const [isExpanded, setIsExpanded] = useState(false);
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug,
        };

        const captureLog = (level: LogLevel) => (...args: any[]) => {
            originalConsole[level](...args);
            const now = new Date();
            setLogs(prevLogs => [
                ...prevLogs,
                { 
                    id: Date.now() + Math.random(),
                    level, 
                    timestamp: now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
                    args 
                }
            ]);
        };

        console.log = captureLog('log');
        console.warn = captureLog('warn');
        console.error = captureLog('error');
        console.info = captureLog('info');
        console.debug = captureLog('debug');

        return () => {
            console.log = originalConsole.log;
            console.warn = originalConsole.warn;
            console.error = originalConsole.error;
            console.info = originalConsole.info;
            console.debug = originalConsole.debug;
        };
    }, []);
    
    useEffect(() => {
        // Auto-scroll to the bottom when a new log is added
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div 
            className={`fixed bottom-0 left-0 right-0 bg-slate-900/90 dark:bg-black/90 backdrop-blur-sm text-white font-mono text-sm z-[100] transition-all duration-300 ease-in-out`}
            style={{ height: isExpanded ? '50vh' : '10vh' }}
        >
            <div className="flex flex-col h-full">
                <header className="flex-shrink-0 flex justify-between items-center p-2 bg-slate-800/80 dark:bg-slate-900/80 border-b border-slate-700">
                    <h3 className="font-bold">Debug Console</h3>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setLogs([])} title="Clear Console" className="hover:text-teal-400 p-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                        <button onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? 'Collapse' : 'Expand'} className="hover:text-teal-400 p-1">
                            {isExpanded ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                </svg>
                            )}
                        </button>
                    </div>
                </header>
                <div ref={logContainerRef} className="flex-grow p-2 overflow-y-auto">
                    {logs.map(log => (
                        <div key={log.id} className={`flex gap-3 py-1 px-2 whitespace-pre-wrap ${getLevelStyles(log.level)}`}>
                            <span className="text-slate-500 flex-shrink-0">{log.timestamp}</span>
                            <div className="flex-grow">
                                {log.args.map((arg, i) => <span key={i}>{formatArg(arg)} </span>)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DebugConsole;
