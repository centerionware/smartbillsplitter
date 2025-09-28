import React from 'react';

const DB_NAME = 'SmartBillSplitterDB'; // Must match the name in db.ts

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  resetMessage?: {
    type: 'error' | 'blocked';
    title: string;
    text: string;
  } | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  // FIX: Refactored the class component to use class property syntax for state
  // and arrow functions for methods to ensure `this` is correctly bound. This resolves
  // the errors where `setState` and `props` were not found on the component instance.
  state: State = {
    hasError: false,
    error: undefined,
    resetMessage: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  // FIX: Converted to an arrow function to correctly bind `this`.
  handleReset = () => {
    // A full page replacement is the most reliable way to reset state after a major error.
    window.location.replace('/');
  }
  
  // FIX: Converted to an arrow function to correctly bind `this`.
  handleHardReset = () => {
    console.warn("Performing hard reset from error boundary.");
    this.setState({ resetMessage: null }); // Clear previous messages

    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onsuccess = () => {
      console.log("Database deleted successfully.");
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    };

    deleteRequest.onerror = () => {
      this.setState({
        resetMessage: {
          type: 'error',
          title: 'Reset Failed',
          text: "Could not delete the database. Please clear your browser's site data manually through the browser settings."
        }
      });
    };

    deleteRequest.onblocked = () => {
      this.setState({
        resetMessage: {
          type: 'blocked',
          title: 'Action Required',
          text: "Database is locked, likely by another open tab. To reset the app, please close all other tabs for this site and then click 'Hard Reset' again."
        }
      });
    };
  }

  render() {
    if (this.state.hasError) {
      const { resetMessage } = this.state;
      return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4">Oops! Something went wrong.</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6">
              The application encountered an unexpected problem. You can try to recover or reset the application.
            </p>

            {resetMessage && (
              <div className={`mb-4 p-4 rounded-r-lg border-l-4 text-left ${
                  resetMessage.type === 'error'
                    ? 'bg-red-100 dark:bg-red-900/40 border-red-500'
                    : 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-500'
                }`}>
                <h4 className={`font-bold ${
                    resetMessage.type === 'error'
                      ? 'text-red-800 dark:text-red-200'
                      : 'text-yellow-800 dark:text-yellow-200'
                  }`}>
                  {resetMessage.title}
                </h4>
                <p className={`text-sm mt-1 ${
                    resetMessage.type === 'error'
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-yellow-700 dark:text-yellow-300'
                  }`}>
                  {resetMessage.text}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <button onClick={this.handleReset} className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600">
                Reload App
              </button>
              <button onClick={this.handleHardReset} className="w-full px-6 py-3 bg-red-100 text-red-800 font-bold rounded-lg hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60">
                Hard Reset & Reload
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Warning:</span> Hard reset will permanently delete all app data from this device.
              </p>
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
