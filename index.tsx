import React from 'react';
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

  const Root: React.FC = () => {
    const reloadApp = () => {
      window.history.replaceState(null, '', '/');
      window.location.reload();
    };

    return (
      <AppControlContext.Provider value={{ reloadApp }}>
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
