import { useEffect, useCallback, useRef } from 'react';

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
    | 'db-migration-complete';

export interface BroadcastMessage {
  type: BroadcastMessageType;
  // Optional payload for future use, not needed for simple reload triggers.
  payload?: any; 
}

/**
 * Posts a message to all other tabs of this application.
 * @param message The message to send.
 */
export const postMessage = (message: BroadcastMessage) => {
  if (channel) {
    channel.postMessage(message);
  }
};

/**
 * A React hook to listen for messages from other tabs.
 * This implementation uses a ref to store the callback, ensuring the event listener
 * always has access to the latest version of the handler without needing to be
 * removed and re-added on every render. This prevents race conditions and stale closures.
 * @param onMessage A memoized callback function to execute when a message is received.
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
    
    // The event handler itself is defined only once.
    // It calls the `current` value of the ref, which is always up-to-date.
    const handleMessage = (event: MessageEvent<BroadcastMessage>) => {
      onMessageRef.current(event.data);
    };

    channel.addEventListener('message', handleMessage);

    // The cleanup function removes the single, consistent event handler.
    return () => {
      channel.removeEventListener('message', handleMessage);
    };
    // The empty dependency array ensures this effect runs only once,
    // setting up and tearing down the listener for the component's entire lifecycle.
  }, []);
};
