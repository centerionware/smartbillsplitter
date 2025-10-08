import { useState, useCallback } from 'react';
import type { RequestConfirmationFn, SettingsSection } from '../../types';
import { useAppControl } from '../../contexts/AppControlContext';

export const useModalStates = () => {
    const [confirmation, setConfirmation] = useState<{ title: string; message: string; onConfirm: () => void; options?: any } | null>(null);
    const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
    const [isCsvImporterOpen, setIsCsvImporterOpen] = useState(false);
    const [isQrImporterOpen, setIsQrImporterOpen] = useState(false);
    const [showDebugConsole, setShowDebugConsole] = useState(() => sessionStorage.getItem('debugConsoleEnabled') === 'true');
    const { showNotification } = useAppControl();

    const requestConfirmation: RequestConfirmationFn = useCallback((title, message, onConfirm, options) => {
        setConfirmation({ title, message, onConfirm, options });
    }, []);

    const toggleDebugConsole = useCallback((enabled: boolean) => {
        sessionStorage.setItem('debugConsoleEnabled', String(enabled));
        setShowDebugConsole(enabled);
        showNotification(`Debug console ${enabled ? 'enabled' : 'disabled'} for this session.`);
    }, [showNotification]);

    return {
        confirmation,
        setConfirmation,
        settingsSection,
        setSettingsSection,
        isCsvImporterOpen,
        setIsCsvImporterOpen,
        isQrImporterOpen,
        setIsQrImporterOpen,
        showDebugConsole,
        toggleDebugConsole,
        requestConfirmation
    };
};
