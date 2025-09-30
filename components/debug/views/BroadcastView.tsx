import React, { useState, useEffect } from 'react';
import type { SignedBroadcastLogEntry } from '../types';
import { getCommunicationKeyPair } from '../../../services/db';
import { verify } from '../../../services/cryptoService';
import { ObjectNode } from '../common/ObjectExplorer';

const BroadcastLogEntry: React.FC<{ log: SignedBroadcastLogEntry }> = ({ log }) => {
    const [verificationResult, setVerificationResult] = useState<any>('Verifying...');

    useEffect(() => {
        const verifyLog = async () => {
            const signedMessage = log.data;
            if (!signedMessage || typeof signedMessage.payload !== 'object' || typeof signedMessage.signature !== 'string') {
                setVerificationResult({ error: "Malformed or unsigned message." });
                return;
            }
            try {
                const keyPair = await getCommunicationKeyPair();
                if (!keyPair?.publicKey) {
                    setVerificationResult({ error: "Public key not found." });
                    return;
                }
                const payloadString = JSON.stringify(signedMessage.payload);
                const isVerified = await verify(payloadString, signedMessage.signature, keyPair.publicKey);
                if (isVerified) {
                    setVerificationResult(signedMessage.payload);
                } else {
                    setVerificationResult({ error: "INVALID SIGNATURE" });
                }
            } catch (e: any) {
                setVerificationResult({ error: e.message });
            }
        };
        verifyLog();
    }, [log]);

    return (
        <div className="grid md:grid-cols-2 gap-4 border-t border-slate-700 py-2">
            <div>
                <h4 className="font-bold text-slate-400 mb-2">Raw Signed Message</h4>
                <div className="bg-slate-800 p-2 rounded-md"><ObjectNode data={log.data} name="(root)" path={`raw-${log.id}`} /></div>
            </div>
            <div>
                <h4 className="font-bold text-slate-400 mb-2">Verification Result</h4>
                <div className="bg-slate-800 p-2 rounded-md"><ObjectNode data={verificationResult} name="(root)" path={`verified-${log.id}`} /></div>
            </div>
        </div>
    );
};

export const BroadcastView: React.FC<{ logs: SignedBroadcastLogEntry[] }> = ({ logs }) => (
    <div className="space-y-2">
        {logs.map(log => (
             <div key={log.id} className="flex gap-3 items-start">
                <span className="text-slate-500 flex-shrink-0">{log.timestamp}</span>
                <div className="flex-grow"><BroadcastLogEntry log={log} /></div>
            </div>
        ))}
    </div>
);
