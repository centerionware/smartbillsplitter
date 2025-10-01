import React from 'react';
import type { ConsoleMode } from '../types';

export const DebugHeader: React.FC<{
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
            {/* FIX: Replaced Vite-specific `import.meta.env.DEV` with `process.env.NODE_ENV` to resolve
            a TypeScript error where `env` was not found on `import.meta`. This is a robust way to
            check for development mode as Vite statically replaces `process.env.NODE_ENV`. */}
            {process.env.NODE_ENV === 'development' && (
              <button onClick={() => setMode('dev')} className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${mode === 'dev' ? 'bg-slate-800 shadow text-teal-400' : 'text-slate-300'}`}>
                  Dev
              </button>
           )}
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