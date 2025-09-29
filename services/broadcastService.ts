import { useEffect, useCallback } from 'react';

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
 * @param onMessage A memoized callback function to execute when a message is received.
 */
export const useBroadcastListener = (onMessage: (message: BroadcastMessage) => void) => {
  const handleMessage = useCallback((event: MessageEvent<BroadcastMessage>) => {
    onMessage(event.data);
  }, [onMessage]);

  useEffect(() => {
    if (channel) {
      channel.addEventListener('message', handleMessage);
      return () => {
        channel.removeEventListener('message', handleMessage);
      };
    }
  }, [handleMessage]);
};
