import React, { useState, useRef, useEffect } from 'react';
import { DebugHeader } from './debug/common/DebugHeader';
import { ConsoleView } from './debug/views/ConsoleView';
import { NetworkView } from './debug/views/NetworkView';
import { BroadcastView } from './debug/views/BroadcastView';
import { DatabaseView } from './debug/views/DatabaseView';
import { DevView } from './debug/views/DevView';
import { NetworkDetailView } from './debug/common/NetworkDetailView';
import { ObjectExplorer } from './debug/common/ObjectExplorer';
import { useDebugServices } from './debug/useDebugServices';
import type { ConsoleMode, NetworkLogEntry } from './debug/types';

interface DebugConsoleProps {
  isDevEnvironment: boolean;
}

const DebugConsole: React.FC<DebugConsoleProps> = ({ isDevEnvironment }) => {
    const { logs, networkLogs, broadcastLogs, clearLogs, clearNetworkLogs, clearBroadcastLogs, networkInterceptionActive } = useDebugServices();
    const [mode, setMode] = useState<ConsoleMode>('console');
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedNetworkLog, setSelectedNetworkLog] = useState<NetworkLogEntry | null>(null);
    const [exploringObject, setExploringObject] = useState<any | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, networkLogs, broadcastLogs, mode, selectedNetworkLog, isExpanded]);

    const handleClear = () => {
        switch (mode) {
            case 'console': clearLogs(); break;
            case 'network': clearNetworkLogs(); setSelectedNetworkLog(null); break;
            case 'broadcast': clearBroadcastLogs(); break;
            case 'database': /* Database view has its own refresh */ break;
        }
    };
    
    const renderContent = () => {
        switch (mode) {
            case 'console': return <ConsoleView logs={logs} onExploreObject={setExploringObject} />;
            case 'network': return selectedNetworkLog ? <NetworkDetailView log={selectedNetworkLog} onBack={() => setSelectedNetworkLog(null)} /> : <NetworkView networkLogs={networkLogs} onSelectLog={setSelectedNetworkLog} interceptionActive={networkInterceptionActive} />;
            case 'broadcast': return <BroadcastView logs={broadcastLogs} />;
            case 'database': return <DatabaseView />;
            case 'dev': return <DevView />;
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
                    setMode={(newMode) => { setMode(newMode); setSelectedNetworkLog(null); }}
                    onClear={handleClear} 
                    isExpanded={isExpanded} 
                    onToggleExpand={() => setIsExpanded(!isExpanded)} 
                    isDevEnvironment={isDevEnvironment}
                />
                <div ref={logContainerRef} className="flex-grow p-2 overflow-auto">
                   {renderContent()}
                </div>
            </div>
            {exploringObject && <ObjectExplorer data={exploringObject} onClose={() => setExploringObject(null)} />}
        </div>
    );
};

export default DebugConsole;