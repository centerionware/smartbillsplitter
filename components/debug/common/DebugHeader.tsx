import React, { useState, useRef, useEffect } from 'react';
import type { ConsoleMode } from '../types';

export const DebugHeader: React.FC<{
    mode: ConsoleMode;
    setMode: (mode: ConsoleMode) => void;
    onClear: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    isDevEnvironment: boolean;
}> = ({ mode, setMode, onClear, isExpanded, onToggleExpand, isDevEnvironment }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const modes: { id: ConsoleMode; label: string }[] = [
        { id: 'console', label: 'Console' },
        { id: 'network', label: 'Network' },
        { id: 'broadcast', label: 'Broadcast' },
        { id: 'database', label: 'Database' },
    ];
    if (isDevEnvironment) {
        modes.push({ id: 'dev', label: 'Dev' });
    }

    const currentModeLabel = modes.find(m => m.id === mode)?.label || 'Console';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    const handleModeSelect = (newMode: ConsoleMode) => {
        setMode(newMode);
        setIsMenuOpen(false);
    };

    return (
        <header className="flex-shrink-0 flex justify-between items-center p-2 bg-slate-800/80 dark:bg-slate-900/80 border-b border-slate-700">
            <div className="relative" ref={menuRef}>
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)} 
                    className="flex items-center gap-2 px-3 py-1 bg-slate-700 rounded-lg text-sm font-semibold text-slate-100 hover:bg-slate-600"
                    aria-haspopup="true"
                    aria-expanded={isMenuOpen}
                >
                    <span>{currentModeLabel}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-20">
                        {modes.map(m => (
                            <button
                                key={m.id}
                                onClick={() => handleModeSelect(m.id)}
                                className={`w-full text-left px-4 py-2 text-sm ${mode === m.id ? 'bg-teal-800/50 text-teal-300' : 'text-slate-200 hover:bg-slate-700'}`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
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
};
