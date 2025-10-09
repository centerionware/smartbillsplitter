import React, { ErrorInfo, ReactNode } from 'react';
import { closeDB } from '../services/db';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  // FIX: Using standard class property syntax for state initialization. This is concise and resolves the reported type errors.
  public state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    // Reloading the page is a safer way to recover from an unknown error state
    // than simply trying to re-render.
    window.location.reload();
  };
  
  handleHardReset = () => {
      console.warn("Performing hard reset from Error Boundary.");
      closeDB();
      const deleteRequest = indexedDB.deleteDatabase('SmartBillSplitterDB');

      deleteRequest.onsuccess = () => {
          console.log("Database deleted successfully.");
          localStorage.clear();
          sessionStorage.clear();
          window.location.reload();
      };
      deleteRequest.onerror = (err) => {
          console.error("Error deleting database:", err);
          alert("Could not delete the database. Please clear your browser's site data manually through the browser settings.");
      };
      deleteRequest.onblocked = () => {
          alert("Database is locked, likely by another open tab. To reset the app, please close all other tabs for this site and then reload this page to try again.");
      };
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4">Something went wrong.</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6">
                  The application has encountered an unexpected error. You can try to recover or reset the application data if the problem persists.
                </p>
                <div className="space-y-4">
                  <button onClick={this.handleReset} className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600">
                    Reload App
                  </button>
                  <button onClick={this.handleHardReset} className="w-full px-6 py-3 bg-red-100 text-red-800 font-bold rounded-lg hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60">
                    Hard Reset App Data
                  </button>
                </div>
                 <details className="mt-4 text-left text-xs text-slate-400 dark:text-slate-500">
                  <summary className="cursor-pointer">Error Details</summary>
                  <pre className="mt-2 p-2 bg-slate-100 dark:bg-slate-700 rounded overflow-auto whitespace-pre-wrap">
                    <code>{this.state.error?.name}: {this.state.error?.message}\n\n{this.state.error?.stack}</code>
                  </pre>
                </details>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}
