import { useEffect, useRef } from 'react';
import { getCommunicationKeyPair } from './db';
import { sign, verify } from './cryptoService';


const CHANNEL_NAME = 'smart-bill-splitter-sync';

// Create a single BroadcastChannel instance to be used throughout the app.
// Check for browser support.
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

if (!channel) {
    console.warn("BroadcastChannel API not supported in this browser. Cross-tab sync will not be available.");
}

export type BroadcastMessageType = 
    | 'bills-updated' 
    | 'imported-bills-updated' 
    | 'recurring-bills-updated' 
    | 'settings-updated' 
    | 'theme-updated' 
    | 'db-close-request' 
    | 'db-migration-complete'
    // FIX: Added 'groups-updated' to the type to support broadcasting group changes.
    | 'groups-updated';

export interface BroadcastMessage {
  type: BroadcastMessageType;
  // Optional payload for future use, not needed for simple reload triggers.
  payload?: any; 
}

interface SignedBroadcastMessage {
  payload: BroadcastMessage;
  signature: string;
}

/**
 * Posts a signed message to all other tabs of this application.
 * @param message The message to send.
 */
export const postMessage = async (message: BroadcastMessage) => {
  if (!channel) return;

  try {
    const keyPair = await getCommunicationKeyPair();
    if (!keyPair?.privateKey) {
        console.error("Broadcast: Communication private key not found. Cannot sign message.");
        return;
    }

    const payloadString = JSON.stringify(message);
    const signature = await sign(payloadString, keyPair.privateKey);

    const signedMessage: SignedBroadcastMessage = {
        payload: message,
        signature: signature,
    };

    channel.postMessage(signedMessage);
  } catch (error) {
    console.error("Failed to sign and post broadcast message:", error);
  }
};

/**
 * A React hook to listen for verified messages from other tabs.
 * @param onMessage A memoized callback function to execute when a valid message is received.
 */
export const useBroadcastListener = (onMessage: (message: BroadcastMessage) => void) => {
  const onMessageRef = useRef(onMessage);

  // Always keep the ref updated with the latest callback from the parent component.
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!channel) {
        return;
    }
    
    // The event handler is now async to handle key retrieval and verification
    const handleMessage = async (event: MessageEvent<any>) => {
        const signedMessage = event.data;

        if (!signedMessage || typeof signedMessage.payload !== 'object' || typeof signedMessage.signature !== 'string') {
            console.warn("Broadcast: Received a malformed or unsigned message. Ignoring.", signedMessage);
            return;
        }

        try {
            const keyPair = await getCommunicationKeyPair();
            if (!keyPair?.publicKey) {
                console.error("Broadcast: Communication public key not found. Cannot verify message.");
                return;
            }

            const payloadString = JSON.stringify(signedMessage.payload);
            const isVerified = await verify(payloadString, signedMessage.signature, keyPair.publicKey);

            if (isVerified) {
                onMessageRef.current(signedMessage.payload);
            } else {
                console.warn("Broadcast: Received a message with an INVALID signature. Ignoring. This could be a security issue or a key mismatch between tabs.", signedMessage);
            }
        } catch (error) {
            console.error("Error during broadcast message verification:", error);
        }
    };

    channel.addEventListener('message', handleMessage);

    // The cleanup function removes the single, consistent event handler.
    return () => {
      channel.removeEventListener('message', handleMessage);
    };
  }, []);
};