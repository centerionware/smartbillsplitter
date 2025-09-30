import React from 'react';
import type { NetworkLogEntry } from '../types';

export const NetworkView: React.FC<{ 
    networkLogs: NetworkLogEntry[], 
    onSelectLog: (log: NetworkLogEntry) => void,
    interceptionActive: boolean 
}> = ({ networkLogs, onSelectLog, interceptionActive }) => {
    if (!interceptionActive) {
        return (
            <div className="p-4 text-center text-slate-400">
                <p className="font-bold">Network Interception Disabled</p>
                <p className="text-xs mt-2">Could not attach to `window.fetch`. This can happen in sandboxed environments or due to browser security policies.</p>
            </div>
        );
    }

    if (networkLogs.length === 0) {
        return <div className="p-4 text-center text-slate-500">No network requests recorded yet.</div>;
    }

    return (
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
};