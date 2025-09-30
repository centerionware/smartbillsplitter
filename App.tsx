import React from 'react';
import { useAppLogic } from './hooks/useAppLogic.ts';

// Components
import Header from './components/Header.tsx';
import { AppRouter } from './components/routing/AppRouter.tsx';
import { AppModals } from './components/modals/AppModals.tsx';
import PwaInstallBanner from './components/PwaInstallBanner.tsx';
import DebugConsole from './components/DebugConsole.tsx';

const App: React.FC = () => {
    const appLogic = useAppLogic();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 flex flex-col">
            <PwaInstallBanner />
            <Header 
                navigate={appLogic.navigate} 
                onOpenSettings={appLogic.setSettingsSection} 
                currentView={appLogic.view} 
            />
            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
                <AppRouter {...appLogic} />
            </main>
            
            <AppModals {...appLogic} />

            {appLogic.showDebugConsole && <DebugConsole />}
        </div>
    );
};

export default App;