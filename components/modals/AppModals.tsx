import React from 'react';
import type { Settings, Theme, RequestConfirmationFn, SettingsSection, Bill, ImportedBill } from '../../types';
import ConfirmationDialog from '../ConfirmationDialog';
import SettingsModal from '../SettingsModal';
import CsvImporterModal from '../CsvImporterModal';
import QrImporterModal from '../QrImporterModal';
import { View } from '../../types';

type AppModalsProps = {
    confirmation: { title: string; message: string; onConfirm: () => void; options?: any } | null;
    setConfirmation: (confirmation: any) => void;
    settingsSection: SettingsSection | null;
    setSettingsSection: (section: SettingsSection | null) => void;
    isCsvImporterOpen: boolean;
    setIsCsvImporterOpen: (isOpen: boolean) => void;
    isQrImporterOpen: boolean;
    setIsQrImporterOpen: (isOpen: boolean) => void;
    // Props for modals
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    requestConfirmation: RequestConfirmationFn;
    navigate: (view: View, params?: any) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    bills: Bill[];
    importedBills: ImportedBill[];
    mergeBills: (bills: any[]) => Promise<any>;
    mergeImportedBills: (bills: any[]) => Promise<any>;
};

export const AppModals: React.FC<AppModalsProps> = ({
    confirmation, setConfirmation,
    settingsSection, setSettingsSection,
    isCsvImporterOpen, setIsCsvImporterOpen,
    isQrImporterOpen, setIsQrImporterOpen,
    ...props
}) => {
    return (
        <>
            {confirmation && (
                <ConfirmationDialog 
                    isOpen={true} 
                    title={confirmation.title} 
                    message={confirmation.message} 
                    onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} 
                    onCancel={() => { if(confirmation.options?.onCancel) confirmation.options.onCancel(); setConfirmation(null); }} 
                    {...confirmation.options} 
                />
            )}
            {settingsSection && (
                <SettingsModal 
                    activeSection={settingsSection} 
                    onClose={() => setSettingsSection(null)} 
                    settings={props.settings} 
                    updateSettings={props.updateSettings} 
                    requestConfirmation={props.requestConfirmation} 
                    onNavigate={props.navigate} 
                    theme={props.theme} 
                    setTheme={props.setTheme} 
                    onOpenCsvImporter={() => { setSettingsSection(null); setIsCsvImporterOpen(true); }} 
                    onOpenQrImporter={() => { setSettingsSection(null); setIsQrImporterOpen(true); }} 
                    bills={props.bills} 
                    importedBills={props.importedBills} 
                />
            )}
            {isCsvImporterOpen && (
                <CsvImporterModal 
                    onClose={() => setIsCsvImporterOpen(false)} 
                    onMergeBills={props.mergeBills} 
                    onMergeImportedBills={props.mergeImportedBills} 
                    settings={props.settings} 
                />
            )}
            {isQrImporterOpen && (
                <QrImporterModal 
                    onClose={() => setIsQrImporterOpen(false)} 
                    onScanSuccess={(url) => { window.location.href = url; setIsQrImporterOpen(false); }} 
                />
            )}
        </>
    );
};
