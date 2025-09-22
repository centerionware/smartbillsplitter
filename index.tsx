import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import AppGate from './AppGate.tsx';
import { AuthProvider } from './hooks/useAuth.ts';
import { AppControlContext } from './contexts/AppControlContext.tsx';
import { initDB } from './services/db.ts';

const Root: React.FC = () => {
  const [appKey, setAppKey] = useState(0);

  const reloadApp = () => {
    // Incrementing the key will cause React to unmount and remount the component tree,
    // effectively resetting all state and re-reading from IndexedDB.
    setAppKey(prevKey => prevKey + 1);
  };

  return (
    <AppControlContext.Provider value={{ reloadApp }}>
      {/* The key is applied here to ensure the entire app, including auth state, is reset on demand */}
      <AuthProvider key={appKey}>
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
