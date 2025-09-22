import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import AppGate from './AppGate';
import { AuthProvider } from './hooks/useAuth';
import { AppControlContext } from './contexts/AppControlContext';

const Root: React.FC = () => {
  const [appKey, setAppKey] = useState(0);

  const reloadApp = () => {
    // Incrementing the key will cause React to unmount and remount the component tree,
    // effectively resetting all state and re-reading from localStorage.
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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
