import React from 'react';
import type { LogEntry, LogLevel } from '../types';

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

export const ConsoleView: React.FC<{ logs: LogEntry[], onExploreObject: (obj: any) => void }> = ({ logs, onExploreObject }) => (
    <>
        {logs.map(log => (
            <div key={log.id} className={`flex gap-3 py-1 px-2 items-start ${getLevelStyles(log.level)}`}>
                <span className="text-slate-500 flex-shrink-0">{log.timestamp}</span>
                <div className="flex-grow flex flex-wrap gap-2">{log.args.map((arg, i) => <div key={i}>{formatArg(arg, onExploreObject)}</div>)}</div>
            </div>
        ))}
    </>
);
