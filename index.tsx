import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import AppGate from './AppGate.tsx';
import { AuthProvider } from './hooks/useAuth.ts';
import { AppControlContext } from './contexts/AppControlContext.tsx';
import { initDB, closeDB } from './services/db.ts';
import { useBroadcastListener, BroadcastMessage } from './services/broadcastService.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initializeApi } from './services/api.ts';

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
        <div id="fallback-message-container" class="mb-4 text-left"></div>
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

  document.getElementById('fallback-reload-btn')?.addEventListener('click', () => {
    window.location.reload();
  });

  document.getElementById('fallback-reset-btn')?.addEventListener('click', () => {
    const messageContainer = document.getElementById('fallback-message-container');
    if (messageContainer) {
        messageContainer.innerHTML = '';
    }
    console.warn("Performing hard reset from fallback UI.");
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onsuccess = () => {
      console.log("Database deleted successfully.");
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    };

    deleteRequest.onerror = () => {
      if (messageContainer) {
        messageContainer.innerHTML = `
          <div class="p-4 bg-red-100 dark:bg-red-900/40 border-l-4 border-red-500 rounded-r-lg">
              <h4 class="font-bold text-red-800 dark:text-red-200">Reset Failed</h4>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                  Could not delete the database. Please clear your browser's site data manually through the browser settings.
              </p>
          </div>
        `;
      } else {
        alert("Could not delete the database. Please clear your browser's site data manually.");
      }
    };
    
    deleteRequest.onblocked = () => {
      if (messageContainer) {
        messageContainer.innerHTML = `
          <div class="p-4 bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-500 rounded-r-lg">
              <h4 class="font-bold text-yellow-800 dark:text-yellow-200">Action Required</h4>
              <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Database is locked, likely by another open tab. To reset the app, please close all other tabs for this site and then click "Hard Reset" again.
              </p>
          </div>
        `;
      } else {
        alert("Database is locked, likely by another open tab. To reset the app, please close all other tabs for this site and then reload this page to try again.");
      }
    };
  });
};


try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  rootElement.innerHTML = `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center text-center p-4 font-sans">
      <svg class="animate-spin h-10 w-10 text-teal-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <h1 class="text-2xl font-semibold text-slate-700 dark:text-slate-200">Initializing App...</h1>
    </div>
  `;
  
  type NotificationType = 'success' | 'info' | 'error';
  interface NotificationState {
    message: string;
    type: NotificationType;
  }

  const Root: React.FC = () => {
    const [notification, setNotification] = useState<NotificationState | null>(null);
    const [isUpdateRequired, setIsUpdateRequired] = useState(false);
    const [isWaitingForMigration, setIsWaitingForMigration] = useState(false);

    const triggerReload = useCallback(() => {
        if (isUpdateRequired || isWaitingForMigration) return;
        setIsUpdateRequired(true);
        setTimeout(() => {
            window.location.reload();
        }, 4000);
    }, [isUpdateRequired, isWaitingForMigration]);

    useEffect(() => {
        window.addEventListener('db-versionchange', triggerReload);
        return () => {
            window.removeEventListener('db-versionchange', triggerReload);
        };
    }, [triggerReload]);
    
    useBroadcastListener(useCallback((message: BroadcastMessage) => {
        if (message.type === 'db-close-request') {
            console.log("Received request to close DB connection for migration.");
            closeDB();
            setIsWaitingForMigration(true);
        } else if (message.type === 'db-migration-complete') {
            if (isWaitingForMigration) {
                console.log("Migration complete in another tab. Reloading now.");
                window.location.reload();
            }
        }
    }, [isWaitingForMigration]));

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
    
    const UpdateScreen: React.FC<{title: string; message: string; showSpinner: boolean}> = ({title, message, showSpinner}) => (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 z-[100] flex justify-center items-center p-4 font-sans backdrop-blur-sm">
            <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 18v-5h5m10-4h5v5h-5M14 18h5v-5h-5" />
                 </svg>
                {/* FIX: Replaced 'class' with 'className' to resolve JSX attribute error. */}
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4">{title}</h1>
                {/* FIX: Replaced 'class' with 'className' to resolve JSX attribute error. */}
                <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6">{message}</p>
                {showSpinner && <div className="flex justify-center items-center">
                    <svg className="animate-spin h-6 w-6 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>}
            </div>
        </div>
    );

    if (isUpdateRequired) {
        return <UpdateScreen title="App Update Required" message="A new version of the app is running in another tab. This page will reload automatically to apply the update." showSpinner={true} />;
    }
    
    if (isWaitingForMigration) {
        return <UpdateScreen title="Applying App Update..." message="Please wait while the update finishes in another tab. This page will reload automatically." showSpinner={true} />;
    }

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

  const startup = async () => {
    // Start API discovery in the background. It will handle its own errors.
    initializeApi();
    // Wait for the local database to be ready, which is essential for the UI.
    await initDB();
  };

  startup().then(() => {
    rootElement.innerHTML = '';
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <Root />
        </ErrorBoundary>
      </React.StrictMode>
    );
  }).catch(err => {
    console.error("Failed to initialize the application.", err);
    renderErrorFallback(err);
  });

} catch (error) {
  console.error("A catastrophic error occurred during app startup:", error);
  if (error instanceof Error) {
    renderErrorFallback(error);
  } else {
    renderErrorFallback(new Error('An unknown error occurred.'));
  }
}
