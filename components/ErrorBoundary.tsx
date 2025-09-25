// FIX: Changed to a namespace import (`import * as React`) to correctly resolve types for the class component, which fixes the error where `this.props` was not recognized.
import * as React from 'react';

const DB_NAME = 'SmartBillSplitterDB'; // Must match the name in db.ts

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  
  private handleReload = () => {
    window.location.reload();
  };
  
  private handleHardReset = async () => {
    console.warn("Performing hard reset: Deleting IndexedDB database.");
    try {
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
      
      deleteRequest.onsuccess = () => {
        console.log("Database deleted successfully.");
        localStorage.clear();
        sessionStorage.clear();
        this.handleReload();
      };
      
      deleteRequest.onerror = (event) => {
        console.error("Error deleting database:", (event.target as any).error);
        alert("Could not delete the database. Please try clearing your browser's site data manually.");
      };

      deleteRequest.onblocked = () => {
        console.warn("Database deletion is blocked. This can happen if the app is open in another tab. Please close all other tabs of this app and try again.");
        alert("Database reset is blocked. Please close all other tabs of this application and click the reset button again.");
      };

    } catch (error) {
      console.error("Failed to initiate database deletion:", error);
      alert("An error occurred while trying to reset the app. Please try clearing your browser's site data manually.");
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
          <div className="w-full max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4">Oops! Something went wrong.</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6">
              The application encountered a problem and cannot continue. This can sometimes be caused by corrupted local data.
            </p>
            <div className="space-y-4">
              <button
                onClick={this.handleReload}
                className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors"
              >
                Reload App
              </button>
              <button
                onClick={this.handleHardReset}
                className="w-full px-6 py-3 bg-red-100 text-red-800 font-bold rounded-lg hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60 transition-colors"
              >
                Hard Reset & Reload
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Warning:</span> Hard reset will permanently delete all your bills and settings from this device.
              </p>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left text-xs text-slate-400 dark:text-slate-500">
                <summary className="cursor-pointer font-semibold">Error Details</summary>
                <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-700 rounded overflow-auto whitespace-pre-wrap text-left">
                  <p className="font-bold text-red-600 dark:text-red-400">{this.state.error.name}: {this.state.error.message}</p>
                  <pre className="mt-1 text-slate-500 dark:text-slate-400">
                    <code>{this.state.error.stack}</code>
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;