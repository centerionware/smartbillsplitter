import React, { useState, useEffect } from 'react';
import { useAppLogic } from './hooks/useAppLogic.ts';
import { View } from './types.ts';
import { getDiscoveredApiBaseUrl } from './services/api.ts';

// Components
import Header from './components/Header.tsx';
import { AppRouter } from './components/routing/AppRouter.tsx';
import { AppModals } from './components/modals/AppModals.tsx';
import PwaInstallBanner from './components/PwaInstallBanner.tsx';
import DebugConsole from './components/DebugConsole.tsx';
import TutorialManager from './components/TutorialManager.tsx';

const App: React.FC = () => {
    const appLogic = useAppLogic();
    const [isDevEnvironment, setIsDevEnvironment] = useState(false);

    useEffect(() => {
      const checkDevEnvironment = async () => {
        const apiUrlString = await getDiscoveredApiBaseUrl();
        // If the URL is an empty string, it's a relative path, meaning same host.
        if (apiUrlString === '') {
          setIsDevEnvironment(true);
          return;
        }
        // If it's a full URL, parse it and compare hostnames.
        if (apiUrlString) {
          try {
            const apiUrl = new URL(apiUrlString);
            if (apiUrl.hostname === window.location.hostname) {
              setIsDevEnvironment(true);
            }
          } catch (e) {
            console.warn("Could not parse discovered API URL for dev environment check:", e);
          }
        }
      };

      checkDevEnvironment();
    }, []); // Run only once after the API is initialized.

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 flex flex-col">
            <PwaInstallBanner />
            <Header 
                navigate={appLogic.navigate} 
                onOpenSettings={appLogic.setSettingsSection} 
                currentView={appLogic.view}
                canInstall={appLogic.canInstall}
                promptInstall={appLogic.promptInstall}
            />
            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
                <AppRouter {...appLogic} />
            </main>
            
            <AppModals {...appLogic} />

            {appLogic.showDebugConsole && <DebugConsole isDevEnvironment={isDevEnvironment} />}

            {appLogic.view === View.Dashboard && (
              <TutorialManager 
                dashboardView={appLogic.dashboardView} 
                selectedParticipant={appLogic.selectedParticipant} 
              />
            )}
        </div>
    );
};

export default App;