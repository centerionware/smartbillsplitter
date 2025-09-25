import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import AppGate from './AppGate.tsx';
import { AuthProvider } from './hooks/useAuth.ts';
import { AppControlContext } from './contexts/AppControlContext.tsx';
import { initDB } from './services/db.ts';
import ErrorBoundary from './components/ErrorBoundary.tsx';

const DB_NAME = 'SmartBillSplitterDB'; // Must match db.ts for the hard reset

/**
 * Renders a static HTML fallback UI in case of a catastrophic startup error.
 * This is a last resort when the React app itself cannot render.
 * @param error The error that caused the failure.
 */
const renderErrorFallback = (error: Error) => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  rootElement.innerHTML = `
    <div class="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div class="w-full max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4">Oops! Something went wrong.</h1>
        <p class="text-slate-500 dark:text-slate-400 mt-2 mb-6">
          The application encountered a critical problem during startup.
        </p>
        <div class="space-y-4">
          <button id="fallback-reload-btn" class="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600">
            Reload App
          </button>
          <button id="fallback-reset-btn" class="w-full px-6 py-3 bg-red-100 text-red-800 font-bold rounded-lg hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60">
            Hard Reset & Reload
          </button>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            <span class="font-semibold">Warning:</span> Hard reset will permanently delete all app data from this device.
          </p>
        </div>
        <details class="mt-4 text-left text-xs text-slate-400 dark:text-slate-500">
          <summary class="cursor-pointer">Error Details</summary>
          <pre class="mt-2 p-2 bg-slate-100 dark:bg-slate-700 rounded overflow-auto whitespace-pre-wrap">
            <code>${error.name}: ${error.message}\n\n${error.stack}</code>
          </pre>
        </details>
      </div>
    </div>
  `;

  // Attach event listeners directly, as onclick attributes in innerHTML can be unreliable.
  document.getElementById('fallback-reload-btn')?.addEventListener('click', () => {
    window.location.reload();
  });

  document.getElementById('fallback-reset-btn')?.addEventListener('click', () => {
    console.warn("Performing hard reset from fallback UI.");
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    deleteRequest.onsuccess = () => {
      console.log("Database deleted successfully.");
      localStorage.clear();
      window.location.reload();
    };
    deleteRequest.onerror = () => {
      alert("Could not delete the database. Please clear your browser's site data manually.");
    };
    deleteRequest.onblocked = () => {
      alert("Database reset is blocked. Please close all other tabs of this app and try again.");
    };
  });
};


try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }
  
  type NotificationType = 'success' | 'info' | 'error';
  interface NotificationState {
    message: string;
    type: NotificationType;
  }

  const Root: React.FC = () => {
    const [notification, setNotification] = useState<NotificationState | null>(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const reloadApp = () => {
      window.history.replaceState(null, '', '/');
      window.location.reload();
    };

    const showNotification = (message: string, type: NotificationType = 'success') => {
        setNotification({ message, type });
    };
    
    const getNotificationStyles = (type: NotificationType) => {
        switch (type) {
            case 'error': return 'bg-red-600 text-white';
            case 'info': return 'bg-blue-600 text-white';
            case 'success':
            default: return 'bg-teal-500 text-white';
        }
    };
    
    const getNotificationIcon = (type: NotificationType) => {
        switch (type) {
            case 'error': return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>;
            case 'info': return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>;
            case 'success':
            default: return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
        }
    };

    return (
      <AppControlContext.Provider value={{ reloadApp, showNotification }}>
        <div className="fixed top-0 left-0 right-0 z-[60] flex justify-center pointer-events-none">
            <div className={`transition-all duration-500 ease-in-out mt-4 px-6 py-3 rounded-lg shadow-lg ${notification ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'} ${notification ? getNotificationStyles(notification.type) : ''}`}>
              <div className="flex items-center gap-3">
                {notification && getNotificationIcon(notification.type)}
                <span className="font-semibold">{notification?.message}</span>
              </div>
            </div>
        </div>
        <AuthProvider>
          <AppGate />
        </AuthProvider>
      </AppControlContext.Provider>
    );
  }

  // Initialize the database before rendering the app
  initDB().then(() => {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <Root />
        </ErrorBoundary>
      </React.StrictMode>
    );
  }).catch(err => {
    // This specifically catches errors from initDB (e.g., IndexedDB not supported)
    console.error("Failed to initialize the database.", err);
    renderErrorFallback(err);
  });

} catch (error) {
  // This is the ultimate catch-all for any synchronous error during startup.
  console.error("A catastrophic error occurred during app startup:", error);
  if (error instanceof Error) {
    renderErrorFallback(error);
  } else {
    renderErrorFallback(new Error('An unknown error occurred.'));
  }
}