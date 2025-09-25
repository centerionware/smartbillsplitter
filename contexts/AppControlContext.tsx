import { createContext, useContext } from 'react';

interface AppControlContextType {
  reloadApp: () => void;
  showNotification: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const AppControlContext = createContext<AppControlContextType>({
  reloadApp: () => {
    console.error("reloadApp called outside of AppControlProvider");
  },
  showNotification: (message: string, type?: 'success' | 'info' | 'error') => {
    console.error("showNotification called outside of AppControlProvider", { message, type });
  }
});

export const useAppControl = () => useContext(AppControlContext);