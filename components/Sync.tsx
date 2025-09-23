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

type Mode = 'idle' | 'sharing' | 'receiving';
type Status = 'idle' | 'connecting' | 'waiting' | 'connected' | 'sending' | 'receiving' | 'confirming' | 'complete' | 'error';

// This is a placeholder URL. In a real-world scenario, this would point
// to a WebSocket-capable serverless function (e.g., on Cloudflare Workers).
// Standard Netlify/Vercel functions do not support persistent WebSocket connections.
const WEBSOCKET_URL = 'wss://sync.bill-splitter.example.com';

const generateSyncCode = () => Math.floor(100000 + Math.random() * 900000).toString();

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
        // Basic validation for a 6-digit code
        if (/^\d{6}$/.test(data)) {
            setInputCode(data);
            stopScanner();
        }
    }, []);
    
    const { isScanning, startScanner, stopScanner, videoRef, error: scannerError } = useQrScanner(handleScan);

    const resetState = () => {
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
    };

    const handleBackClick = () => {
        resetState();
        onBack();
    }
    
    const connectWebSocket = (code: string, isInitiator: boolean) => {
        setStatus('connecting');
        setErrorMessage(null);

        const ws = new WebSocket(`${WEBSOCKET_URL}?code=${code}`);
        wsRef.current = ws;

        ws.onopen = () => {
             console.log('WebSocket connected');
             setStatus(isInitiator ? 'waiting' : 'connected');
             if (!isInitiator) {
                 ws.send(JSON.stringify({ type: 'receiver_ready' }));
             }
        };

        ws.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('Received message:', message.type);

                if (isInitiator) {
                    // --- SENDER LOGIC ---
                    if (message.type === 'receiver_ready') {
                        setStatus('connected');
                        await startDataTransfer();
                    }
                } else {
                    // --- RECEIVER LOGIC ---
                    if (message.type === 'key') {
                        encryptionKeyRef.current = await cryptoService.importKey(message.key);
                    } else if (message.type === 'data') {
                        setStatus('receiving');
                        if (!encryptionKeyRef.current) throw new Error('Encryption key not received.');
                        const decryptedData = await cryptoService.decrypt(message.payload, encryptionKeyRef.current);
                        const parsedData = JSON.parse(decryptedData);
                        
                        setStatus('confirming');
                        requestConfirmation(
                            'Confirm Data Import',
                            'Data has been received from the other device. This will overwrite all current bills and settings. Do you want to proceed?',
                            async () => {
                                try {
                                    await importData(parsedData);
                                    ws.send(JSON.stringify({ type: 'sync_complete' }));
                                    setStatus('complete');
                                    // Give a moment for the user to see the success message
                                    setTimeout(() => reloadApp(), 1500);
                                } catch (e) {
                                    console.error("Import error:", e);
                                    setErrorMessage('Failed to apply the received data.');
                                    setStatus('error');
                                }
                            },
                            { confirmText: 'Overwrite', confirmVariant: 'danger', cancelText: 'Cancel' }
                        );
                    }
                }

                if (message.type === 'sync_complete' && isInitiator) {
                     setStatus('complete');
                } else if (message.type === 'error') {
                    setErrorMessage(message.message || 'An unknown error occurred.');
                    setStatus('error');
                    ws.close();
                }

            } catch (error) {
                console.error('Error processing message:', error);
                setErrorMessage('An error occurred during data transfer.');
                setStatus('error');
                ws.close();
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected.');
            if (status !== 'complete' && status !== 'idle') {
                // If it wasn't a clean close, show an error.
                if (status !== 'error') {
                    setErrorMessage('Connection to the sync service was lost.');
                    setStatus('error');
                }
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setErrorMessage('Could not connect to the sync service. Please check your internet connection and try again.');
            setStatus('error');
        };
    };

    const startSharing = () => {
        const newCode = generateSyncCode();
        setSyncCode(newCode);
        setMode('sharing');
        connectWebSocket(newCode, true);
    };
    
    const startReceiving = () => {
        if (/^\d{6}$/.test(inputCode)) {
            setSyncCode(inputCode);
            setMode('receiving');
            connectWebSocket(inputCode, false);
        } else {
            setErrorMessage('Please enter a valid 6-digit code.');
            setStatus('error');
        }
    };
    
    const startDataTransfer = async () => {
        if (!wsRef.current) return;
        setStatus('sending');
        try {
            // 1. Generate & send encryption key
            const key = await cryptoService.generateKey();
            const exportedKey = await cryptoService.exportKey(key);
            wsRef.current.send(JSON.stringify({ type: 'key', key: exportedKey }));
            
            // 2. Export, encrypt, and send data
            const data = await exportData();
            const encryptedData = await cryptoService.encrypt(JSON.stringify(data), key);
            wsRef.current.send(JSON.stringify({ type: 'data', payload: encryptedData }));
        } catch (error) {
            console.error('Error during data transfer:', error);
            setErrorMessage('Failed to send data.');
            setStatus('error');
        }
    };

    useEffect(() => {
        // Cleanup WebSocket on component unmount
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (isScanning) {
                stopScanner();
            }
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
            'connected': 'Device connected! Preparing data...',
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
                <video ref={videoRef} className="w-full h-auto max-w-lg rounded-lg shadow-2xl" />
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
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.03 1.125 0 1.131.094 1.976 1.057 1.976 2.192V7.5m-9 7.5h10.5a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H5.25a2.25 2.25 0 00-2.25 2.25v10.5a2.25 2.25 0 002.25 2.25z" /></svg>
                            <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Share Data</h3>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">Send data from this device.</p>
                        </button>
                        <button onClick={() => setMode('receiving')} className="flex-1 p-8 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all transform hover:-translate-y-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 10.5a8.25 8.25 0 0115 5.636l-1.5-1.5m-1.5 1.5l1.5-1.5M3 10.5a8.25 8.25 0 0115 5.636" /></svg>
                            <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Receive Data</h3>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">Load data onto this device.</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'sharing') {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${syncCode}&qzone=1`;
        return (
            <div className="max-w-md mx-auto text-center">
                 <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">Share Data</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">On your other device, choose "Receive Data" and enter or scan this code.</p>
                    
                    <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg">
                        <p className="text-5xl font-bold tracking-widest text-slate-800 dark:text-slate-100">{syncCode.replace(/(\d{3})(?=\d)/, '$1 ')}</p>
                    </div>

                    <div className="my-6 p-4 bg-white rounded-lg inline-block">
                        <img src={qrUrl} alt="QR Code for sync" width="256" height="256"/>
                    </div>

                    {renderStatus()}
                    <button onClick={handleBackClick} className="mt-4 px-6 py-3 w-full bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                 </div>
            </div>
        );
    }
    
    if (mode === 'receiving') {
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
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                             <span className="sr-only">Scan QR Code</span>
                         </button>
                    </div>

                    {renderStatus()}
                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <button onClick={handleBackClick} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                        <button onClick={startReceiving} disabled={inputCode.length !== 6 || status === 'connecting' || status === 'complete'} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-slate-400 dark:disabled:bg-slate-600">Connect</button>
                    </div>
                 </div>
            </div>
        );
    }

    return null;
};

export default SyncComponent;
