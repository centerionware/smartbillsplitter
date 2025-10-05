import { useState, useEffect, useCallback } from 'react';
import type { LogEntry, NetworkLogEntry, SignedBroadcastLogEntry, LogLevel } from './types';

// This is a global flag to prevent infinite loops if the console itself logs something.
let isIntercepting = false;

export const useDebugServices = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [networkLogs, setNetworkLogs] = useState<NetworkLogEntry[]>([]);
    const [broadcastLogs, setBroadcastLogs] = useState<SignedBroadcastLogEntry[]>([]);
    const [networkInterceptionActive, setNetworkInterceptionActive] = useState(true);

    const addLog = useCallback((level: LogLevel, args: any[]) => {
        if (isIntercepting) return;
        isIntercepting = true;
        setLogs(prevLogs => [
            ...prevLogs,
            {
                id: prevLogs.length,
                level,
                timestamp: new Date().toLocaleTimeString(),
                args,
            },
        ]);
        isIntercepting = false;
    }, []);

    const addNetworkLog = useCallback((log: Omit<NetworkLogEntry, 'id'>) => {
        setNetworkLogs(prevLogs => [...prevLogs, { ...log, id: prevLogs.length }]);
    }, []);
    
    const updateNetworkLog = useCallback((id: number, updates: Partial<NetworkLogEntry>) => {
        setNetworkLogs(prevLogs => prevLogs.map(log => log.id === id ? { ...log, ...updates } : log));
    }, []);

    const addBroadcastLog = useCallback((data: any) => {
        setBroadcastLogs(prevLogs => [
            ...prevLogs,
            {
                id: prevLogs.length,
                timestamp: new Date().toLocaleTimeString(),
                data,
            },
        ]);
    }, []);

    const clearLogs = useCallback(() => setLogs([]), []);
    const clearNetworkLogs = useCallback(() => setNetworkLogs([]), []);
    const clearBroadcastLogs = useCallback(() => setBroadcastLogs([]), []);

    // Effect for console interception
    useEffect(() => {
        const originalConsole = { ...console };
        
        const intercept = (level: LogLevel) => (...args: any[]) => {
            addLog(level, args);
            originalConsole[level](...args);
        };

        console.log = intercept('log');
        console.warn = intercept('warn');
        console.error = intercept('error');
        console.info = intercept('info');
        console.debug = intercept('debug');

        return () => {
            Object.assign(console, originalConsole);
        };
    }, [addLog]);

    // Effect for network interception
    useEffect(() => {
        if (typeof window.fetch !== 'function') {
            setNetworkInterceptionActive(false);
            return;
        }
        
        const originalFetch = window.fetch;
        let nextNetworkLogId = 0;

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const id = nextNetworkLogId++;
            const request = new Request(input, init);

            let requestBody: any = null;
            if (request.body) {
                try {
                    // Clone to read, as body can only be read once
                    requestBody = await request.clone().json();
                } catch {
                    try {
                        requestBody = await request.clone().text();
                    } catch {
                         requestBody = '[Could not read body]';
                    }
                }
            }
            
            // This needs to happen before the actual fetch call
            // so we capture the request right away.
            // Using a function updater with setNetworkLogs to avoid stale state.
            setNetworkLogs(prevLogs => [
                ...prevLogs,
                {
                    id,
                    url: request.url,
                    method: request.method,
                    status: null,
                    ok: null,
                    timestamp: new Date().toLocaleTimeString(),
                    requestHeaders: Object.fromEntries(request.headers.entries()),
                    requestBody,
                    responseHeaders: {},
                    responseBody: null,
                }
            ]);

            try {
                const response = await originalFetch(request);
                const responseClone = response.clone();
                
                let responseBody: any = null;
                try {
                    responseBody = await responseClone.json();
                } catch {
                    try {
                        responseBody = await responseClone.text();
                    } catch {
                        responseBody = '[Could not read body]';
                    }
                }
                
                updateNetworkLog(id, {
                    status: response.status,
                    ok: response.ok,
                    responseHeaders: Object.fromEntries(response.headers.entries()),
                    responseBody,
                });
                
                return response;
            } catch (error) {
                updateNetworkLog(id, { status: 0, ok: false, responseBody: error });
                throw error;
            }
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, [addNetworkLog, updateNetworkLog]);
    
    // Effect for BroadcastChannel interception
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;
        const originalPostMessage = BroadcastChannel.prototype.postMessage;
        
        BroadcastChannel.prototype.postMessage = function(message: any) {
            addBroadcastLog(message);
            return originalPostMessage.apply(this, [message]);
        };

        return () => {
            BroadcastChannel.prototype.postMessage = originalPostMessage;
        };
    }, [addBroadcastLog]);

    return { logs, networkLogs, broadcastLogs, clearLogs, clearNetworkLogs, clearBroadcastLogs, networkInterceptionActive };
};
