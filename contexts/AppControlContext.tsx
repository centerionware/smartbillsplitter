import { createContext, useContext } from 'react';

interface AppControlContextType {
  reloadApp: () => void;
}

export const AppControlContext = createContext<AppControlContextType>({
  reloadApp: () => {
    // This is a fallback and should ideally never be called.
    // The provider in index.tsx will supply the actual implementation.
    console.error("reloadApp called outside of AppControlProvider");
  },
});

export const useAppControl = () => useContext(AppControlContext);
