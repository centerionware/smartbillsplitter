import React, { useState, useEffect } from 'react';
import { useAppLogic } from './hooks/useAppLogic';
import { View } from './types';
import { getDiscoveredApiBaseUrl } from './services/api';

// Components
import Header from './components/Header';
import { AppRouter } from './components/routing/AppRouter';
import { AppModals } from './components/modals/AppModals';
import PwaInstallBanner from './components/PwaInstallBanner';
import DebugConsole from './components/DebugConsole';
import TutorialManager from './components/TutorialManager';

const App: React.FC = () => {
    const appLogic = useAppLogic();
    // Use null to represent the "checking" state.
    const [isDevEnvironment, setIsDevEnvironment] = useState<boolean | null>(null);

    // This effect runs once to determine if the environment is 'dev'
    // based on the user's specific definition.
    useEffect(() => {
        const determineEnv = async () => {
            const backendUrl = await getDiscoveredApiBaseUrl();
            if (backendUrl === '') {
                // Fallback to relative path means same host, so it's a dev environment.
                setIsDevEnvironment(true);
            } else if (backendUrl) {
                try {
                    const backendHost = new URL(backendUrl).hostname;
                    const frontendHost = window.location.hostname;
                    setIsDevEnvironment(backendHost === frontendHost);
                } catch (e) {
                    // Invalid URL, assume not dev.
                    setIsDevEnvironment(false);
                }
            } else {
                // API_BASE_URL is null, discovery must have failed. Assume not dev.
                setIsDevEnvironment(false);
            }
        };

        determineEnv();
    }, []);

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

            {/* Only render the debug console once the environment has been determined. */}
            {appLogic.showDebugConsole && isDevEnvironment !== null && (
              <DebugConsole isDevEnvironment={isDevEnvironment} />
            )}

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