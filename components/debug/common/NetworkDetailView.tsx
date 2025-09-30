import React, { useState } from 'react';
import type { NetworkLogEntry, DetailView } from '../types';
import { ObjectNode } from './ObjectExplorer';

export const NetworkDetailView: React.FC<{ 
    log: NetworkLogEntry, 
    onBack: () => void
}> = ({ log, onBack }) => {
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
