import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { RequestConfirmationFn } from '../App.tsx';
import { exportData, importData } from '../services/db.ts';
import * as cryptoService from '../services/cryptoService.ts';
import { useAppControl } from '../contexts/AppControlContext.tsx';
import { useQrScanner } from '../hooks/useQrScanner.ts';

interface SyncProps {
  onBack: () => void;
  requestConfirmation: RequestConfirmationFn;
}

type Mode = 'idle' | 'sharing' | 'receivingInput' | 'syncing';
type Status = 'idle' | 'connecting' | 'waiting' | 'connected' | 'sending' | 'receiving' | 'confirming' | 'complete' | 'error';

const getWebSocketUrl = (code?: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    // The path must match the path of our edge function
    const path = '/sync';
    return code ? `${protocol}://${host}${path}?code=${code}` : `${protocol}://${host}${path}`;
};


const SyncComponent: React.FC<SyncProps> = ({ onBack, requestConfirmation }) => {
    const [mode, setMode] = useState<Mode>('idle');
    const [status, setStatus] = useState<Status>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [syncCode, setSyncCode] = useState('');
    const [inputCode, setInputCode] = useState('');
    const { reloadApp } = useAppControl();
    
    const wsRef = useRef<WebSocket | null>(null);
    const encryptionKeyRef = useRef<CryptoKey | null>(null);

    const handleScan = useCallback((data: string) => {
        if (/^\d{6}$/.test(data)) {
            setInputCode(data);
            stopScanner();
        }
    }, []);
    
    const { isScanning, startScanner, stopScanner, videoRef, error: scannerError } = useQrScanner(handleScan);

    const resetState = useCallback(() => {
        setMode('idle');
        setStatus('idle');
        setErrorMessage(null);
        setSyncCode('');
        setInputCode('');
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        encryptionKeyRef.current = null;
    }, []);

    const handleBackClick = () => {
        resetState();
        onBack();
    }

    const startDataTransfer = async () => {
        if (!wsRef.current) return;
        setStatus('sending');
        try {
            const key = await cryptoService.generateKey();
            encryptionKeyRef.current = key; // Store for potential re-sends if needed
            const exportedKey = await cryptoService.exportKey(key);
            wsRef.current.send(JSON.stringify({ type: 'key', key: exportedKey }));
            
            const data = await exportData();
            const encryptedData = await cryptoService.encrypt(JSON.stringify(data), key);
            wsRef.current.send(JSON.stringify({ type: 'data', payload: encryptedData }));
        } catch (error) {
            console.error('Error during data transfer:', error);
            setErrorMessage('Failed to send data.');
            setStatus('error');
        }
    };
    
    const startSharing = () => {
        setMode('syncing');
        setStatus('connecting');
        setErrorMessage(null);

        const ws = new WebSocket(getWebSocketUrl());
        wsRef.current = ws;

        ws.onopen = () => console.log('Sender WebSocket connected, waiting for session...');

        ws.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log("Sender received:", message.type);
                switch (message.type) {
                    case 'session_created':
                        setSyncCode(message.code);
                        setStatus('waiting');
                        break;
                    case 'peer_joined':
                        setStatus('connected');
                        await startDataTransfer();
                        break;
                    case 'sync_complete':
                        setStatus('complete');
                        setTimeout(() => {
                           handleBackClick();
                        }, 2000);
                        break;
                    case 'error':
                        setErrorMessage(message.message || 'An error occurred on the other device.');
                        setStatus('error');
                        break;
                    case 'peer_disconnected':
                        setErrorMessage('The other device disconnected.');
                        setStatus('error');
                        break;
                }
            } catch (e) {
                console.error("Failed to parse WebSocket message:", e);
                setErrorMessage("Received an invalid message from the other device.");
                setStatus('error');
            }
        };
        ws.onclose = () => {
             if (status !== 'complete' && status !== 'idle') {
                if (status !== 'error') {
                    setErrorMessage('Connection to the sync service was lost.');
                    setStatus('error');
                }
            }
        };
        ws.onerror = () => {
            setErrorMessage('Could not connect to sync service.');
            setStatus('error');
        };
    };

    const startReceiving = () => {
        if (!/^\d{6}$/.test(inputCode)) {
            setErrorMessage('Please enter a valid 6-digit code.');
            setStatus('error');
            return;
        }

        setMode('syncing');
        setStatus('connecting');
        setErrorMessage(null);

        const ws = new WebSocket(getWebSocketUrl(inputCode));
        wsRef.current = ws;

        ws.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log("Receiver received:", message.type);
                switch (message.type) {
                    case 'key':
                        encryptionKeyRef.current = await cryptoService.importKey(message.key);
                        break;
                    case 'data':
                        if (!encryptionKeyRef.current) {
                            setErrorMessage("Data received before encryption key. Sync failed.");
                            setStatus('error');
                            return;
                        }
                        setStatus('receiving');
                        const decryptedData = await cryptoService.decrypt(message.payload, encryptionKeyRef.current);
                        const parsedData = JSON.parse(decryptedData);
                        
                        setStatus('confirming');
                        requestConfirmation(
                            'Confirm Data Import',
                            'Data has been received. This will overwrite all current bills and settings.',
                            async () => {
                                await importData(parsedData);
                                ws.send(JSON.stringify({ type: 'sync_complete' }));
                                setStatus('complete');
                                setTimeout(() => reloadApp(), 2000);
                            },
                            { 
                                confirmText: 'Overwrite & Import', 
                                confirmVariant: 'danger', 
                                onCancel: () => {
                                    ws.send(JSON.stringify({ type: 'error', message: 'User cancelled import.' }));
                                    resetState();
                                }
                            }
                        );
                        break;
                     case 'error':
                        setErrorMessage(message.message || 'An error occurred.');
                        setStatus('error');
                        break;
                    case 'peer_disconnected':
                        setErrorMessage('The other device disconnected.');
                        setStatus('error');
                        break;
                }
            } catch (e) {
                console.error("Failed to parse WebSocket message:", e);
                setErrorMessage("Received an invalid message from the other device.");
                setStatus('error');
            }
        };
        ws.onopen = () => {
            console.log('Receiver connected.');
            setStatus('connected');
        };
        ws.onclose = () => {
             if (status !== 'complete' && status !== 'idle') {
                if (status !== 'error') {
                    setErrorMessage('Connection to the sync service was lost.');
                    setStatus('error');
                }
            }
        };
        ws.onerror = () => {
            setErrorMessage('Could not connect to sync service. The code may be invalid or expired.');
            setStatus('error');
        };
    };

    useEffect(() => {
        return () => { // Cleanup on unmount
            if (wsRef.current) wsRef.current.close();
            if (isScanning) stopScanner();
        };
    }, [isScanning, stopScanner]);

    const renderStatus = () => {
        const getStatusColor = () => {
            if (status === 'error') return 'text-red-500 dark:text-red-400';
            if (status === 'complete') return 'text-emerald-500 dark:text-emerald-400';
            return 'text-slate-500 dark:text-slate-400';
        };
        const message = errorMessage || {
            'idle': 'Select an option to begin.',
            'connecting': 'Connecting to sync service...',
            'waiting': 'Waiting for the other device to connect...',
            'connected': 'Device connected! Transferring data...',
            'sending': 'Encrypting and sending your data...',
            'receiving': 'Receiving and decrypting data...',
            'confirming': 'Waiting for your confirmation...',
            'complete': 'Sync complete! Your data has been transferred.',
            'error': 'An error occurred.'
        }[status];
        
        return <p className={`text-center font-semibold mt-4 h-6 ${getStatusColor()}`}>{message}</p>;
    };

    if (isScanning) {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
                <video ref={videoRef} className="w-full h-auto max-w-lg rounded-lg shadow-2xl" playsInline autoPlay/>
                <div className="absolute top-4 left-4 text-white text-lg font-bold bg-black/50 p-3 rounded-lg">Scan QR Code</div>
                <div className="mt-4">
                    <button onClick={stopScanner} className="px-6 py-3 bg-slate-600/70 text-white font-semibold rounded-lg text-lg">Cancel</button>
                </div>
                {scannerError && <p className="mt-4 p-3 text-sm text-red-100 bg-red-800/80 rounded-lg">{scannerError}</p>}
            </div>
        );
    }
    
    if (mode === 'idle') {
        return (
            <div className="max-w-2xl mx-auto text-center">
                <button onClick={handleBackClick} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Back to Settings
                </button>
                <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
                    <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200 mb-2">Sync Devices</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">Securely transfer your app data between two devices.</p>
                    <div className="flex flex-col md:flex-row gap-6">
                        <button onClick={startSharing} className="flex-1 p-8 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all transform hover:-translate-y-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" /></svg>
                            <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Share Data</h3>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">Send data from this device.</p>
                        </button>
                        <button onClick={() => setMode('receivingInput')} className="flex-1 p-8 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all transform hover:-translate-y-1">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                            <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Receive Data</h3>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">Load data onto this device.</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
     if (mode === 'receivingInput') {
         return (
             <div className="max-w-md mx-auto text-center">
                 <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">Receive Data</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">Enter the 6-digit code from your other device.</p>
                    
                    <div className="flex gap-2">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={inputCode}
                            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="_ _ _   _ _ _"
                            className="flex-grow p-4 text-3xl text-center tracking-[0.5em] font-mono bg-slate-100 dark:bg-slate-700 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                        />
                         <button onClick={startScanner} className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-slate-200 dark:hover:bg-slate-600">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
                             <span className="sr-only">Scan QR Code</span>
                         </button>
                    </div>
                    {renderStatus()}

                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <button onClick={() => setMode('idle')} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Back</button>
                        <button onClick={startReceiving} disabled={inputCode.length !== 6} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-slate-400 dark:disabled:bg-slate-600">Connect</button>
                    </div>
                 </div>
            </div>
        );
    }
    
    if (mode === 'syncing') {
         const qrUrl = syncCode ? `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${syncCode}&qzone=1` : '';
         return (
            <div className="max-w-md mx-auto text-center">
                 <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">{syncCode ? 'Share Data' : 'Receiving Data'}</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        {syncCode ? 'On your other device, choose "Receive Data" and enter or scan this code.' : 'Connected. Waiting to receive data...'}
                    </p>
                    
                    {syncCode && (
                        <>
                            <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg">
                                <p className="text-5xl font-bold tracking-widest text-slate-800 dark:text-slate-100">{syncCode.replace(/(\d{3})(?=\d)/, '$1 ')}</p>
                            </div>

                            <div className="my-6 p-4 bg-white rounded-lg inline-block">
                                <img src={qrUrl} alt="QR Code for sync" width="256" height="256"/>
                            </div>
                        </>
                    )}
                    
                    {status === 'connecting' && (
                         <svg className="animate-spin h-12 w-12 text-teal-500 mx-auto my-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    
                    {renderStatus()}
                    <button onClick={handleBackClick} className="mt-4 px-6 py-3 w-full bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                 </div>
            </div>
        );
    }

    return null;
};

export default SyncComponent;