import { useState, useEffect } from 'react';
import type { LogEntry, NetworkLogEntry, SignedBroadcastLogEntry, LogLevel } from './types';

export const useDebugServices = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [networkLogs, setNetworkLogs] = useState<NetworkLogEntry[]>([]);
    const [broadcastLogs, setBroadcastLogs] = useState<SignedBroadcastLogEntry[]>([]);
    const [networkInterceptionActive, setNetworkInterceptionActive] = useState(false);

    useEffect(() => {
        const originalConsole = { 
            log: console.log, 
            warn: console.warn, 
            error: console.error, 
            info: console.info, 
            debug: console.debug 
        };

        const captureLog = (level: LogLevel) => (...args: any[]) => {
            originalConsole[level](...args);
            const now = new Date();
            setLogs(prev => [...prev, { 
                id: Date.now() + Math.random(), 
                level, 
                timestamp: now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
                args: [...args] 
            }]);
        };
        
        const originalFetch = window.fetch;
        let fetchPatched = false;

        try {
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const now = new Date();
                // FIX: Correctly handle `input` which can be a string, Request object, or URL object.
                const url = typeof input === 'string'
                    ? input
                    : (input instanceof URL ? input.href : input.url);
                const logEntry: NetworkLogEntry = {
                    id: Date.now() + Math.random(),
                    url: url,
                    method: init?.method?.toUpperCase() || 'GET',
                    status: null,
                    ok: null,
                    timestamp: now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    requestHeaders: {},
                    requestBody: init?.body,
                    responseHeaders: {},
                    responseBody: null,
                };

                if (init?.headers) {
                    if (init.headers instanceof Headers) {
                        init.headers.forEach((value, key) => { logEntry.requestHeaders[key] = value; });
                    } else if (Array.isArray(init.headers)) {
                        init.headers.forEach(([key, value]) => { logEntry.requestHeaders[key] = value; });
                    } else {
                        logEntry.requestHeaders = init.headers as Record<string, string>;
                    }
                }

                setNetworkLogs(prev => [...prev, logEntry]);

                try {
                    const response = await originalFetch(input, init);
                    
                    const responseHeaders: Record<string, string> = {};
                    response.headers.forEach((value, key) => { responseHeaders[key] = value; });
                    
                    const responseClone = response.clone();
                    let responseBody: any = '[Could not read body]';
                    try {
                        const contentType = response.headers.get('content-type');
                        if (contentType?.includes('application/json')) {
                            responseBody = await responseClone.json();
                        } else {
                            responseBody = await responseClone.text();
                        }
                    } catch (e) { /* Ignore body reading errors */ }

                    setNetworkLogs(prev => prev.map(log => log.id === logEntry.id ? { ...log, status: response.status, ok: response.ok, responseHeaders, responseBody } : log));
                    return response;
                } catch (error: any) {
                    setNetworkLogs(prev => prev.map(log => log.id === logEntry.id ? { ...log, status: 0, ok: false, responseBody: error.message } : log));
                    throw error;
                }
            };
            fetchPatched = true;
            setNetworkInterceptionActive(true);
        } catch (error) {
            console.warn("Debug Console: Could not intercept network requests. The Network tab will be disabled.", error);
            // If the initial assignment fails, window.fetch is unchanged. No need to restore it.
            // Attempting to restore it here would cause another, unhandled exception.
            setNetworkInterceptionActive(false);
        }

        const captureChannel = new BroadcastChannel('smart-bill-splitter-sync');
        const handleRawMessage = (event: MessageEvent<any>) => {
            const now = new Date();
            setBroadcastLogs(prev => [...prev, {
                id: Date.now() + Math.random(),
                timestamp: now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                data: event.data
            }]);
        };
        captureChannel.addEventListener('message', handleRawMessage);

        console.log = captureLog('log');
        console.warn = captureLog('warn');
        console.error = captureLog('error');
        console.info = captureLog('info');
        console.debug = captureLog('debug');

        return () => {
            Object.assign(console, originalConsole);
            if (fetchPatched) {
                window.fetch = originalFetch;
            }
            captureChannel.removeEventListener('message', handleRawMessage);
            captureChannel.close();
        };
    }, []);

    const clearLogs = () => setLogs([]);
    const clearNetworkLogs = () => setNetworkLogs([]);
    const clearBroadcastLogs = () => setBroadcastLogs([]);

    return { 
        logs, 
        networkLogs, 
        broadcastLogs, 
        clearLogs, 
        clearNetworkLogs, 
        clearBroadcastLogs,
        networkInterceptionActive
    };
};