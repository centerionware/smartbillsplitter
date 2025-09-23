import React from 'react';
import ReactDOM from 'react-dom/client';
import AppGate from './AppGate.tsx';
import { AuthProvider } from './hooks/useAuth.ts';
import { AppControlContext } from './contexts/AppControlContext.tsx';
import { initDB } from './services/db.ts';

const Root: React.FC = () => {
  const reloadApp = () => {
    // Replace the current history entry and reload the page from the root.
    // This effectively clears the forward/back history within the app for this session,
    // preventing users from navigating "back" to a state that no longer exists
    // (e.g., the settings page after a data reset).
    window.location.replace('/');
  };

  return (
    <AppControlContext.Provider value={{ reloadApp }}>
      <AuthProvider>
        <AppGate />
      </AuthProvider>
    </AppControlContext.Provider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Initialize the database before rendering the app
initDB().then(() => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
}).catch(err => {
  console.error("Failed to initialize the database.", err);
  rootElement.innerHTML = `
    <div style="padding: 2rem; text-align: center; font-family: sans-serif;">
      <h1 style="color: #dc2626;">Application Error</h1>
      <p style="color: #4b5563;">Could not initialize the database. This app requires a modern browser with IndexedDB support.</p>
    </div>
  `;
});