import React, { useState, useEffect } from 'react';
// FIX: Changed import statement to correctly import `View` as a value (for enums)
// and other symbols as types, resolving 'cannot be used as a value' error.
import { View, type Settings, type Theme, type RequestConfirmationFn, type SettingsSection, type Bill, type ImportedBill } from '../../types';
import Personalization from './settings/Personalization';
import PaymentIntegrations from './settings/PaymentIntegrations';
import BillReminders from './settings/BillReminders';
import DataManagement from './settings/DataManagement';
import DataSync from './settings/DataSync';
import DangerZone from './settings/DangerZone';
import SubscriptionManagement from './settings/SubscriptionManagement';
import { useAppControl } from '../contexts/AppControlContext.tsx';
import AboutSupport from './settings/AboutSupport';

interface SettingsModalProps {
  activeSection: SettingsSection;
  onClose: () => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  onNavigate: (view: View, params?: any) => void;
  requestConfirmation: RequestConfirmationFn;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onOpenCsvImporter: () => void;
  onOpenQrImporter: () => void;
  bills: Bill[];
  importedBills: ImportedBill[];
  showDebugConsole: boolean;
  toggleDebugConsole: (enabled: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const { activeSection, onClose, settings, updateSettings } = props;
  const [formData, setFormData] = useState(settings);
  const [isDirty, setIsDirty] = useState(false);
  const { showNotification } = useAppControl();

  useEffect(() => {
    setFormData(settings);
    setIsDirty(false); // Reset dirty state when settings prop changes (e.g., after save)
  }, [settings, activeSection]);

  const handleFormChange = (newValues: Partial<Settings>) => {
    setFormData(prev => ({ ...prev, ...newValues }));
    setIsDirty(true);
  };
  
  const handlePaymentDetailsChange = (newDetails: Partial<Settings['paymentDetails']>) => {
    setFormData(prev => ({ ...prev, paymentDetails: { ...prev.paymentDetails, ...newDetails }}));
    setIsDirty(true);
  };
  
  const handleSave = async () => {
    await updateSettings(formData);
    showNotification('Settings saved successfully!');
    onClose();
  };
  
  const handleCancel = () => {
    if (isDirty) {
      props.requestConfirmation(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        onClose,
        { confirmText: 'Discard', confirmVariant: 'danger' }
      );
    } else {
      onClose();
    }
  };

  const sectionConfig: { [key in SettingsSection]: { title: string; component: React.ReactNode; hasSave?: boolean } } = {
    personalization: { title: 'Personalization', component: <Personalization settings={formData} onSettingsChange={handleFormChange} theme={props.theme} setTheme={props.setTheme} />, hasSave: true },
    payments: { title: 'Payment Methods', component: <PaymentIntegrations settings={formData} onPaymentDetailsChange={handlePaymentDetailsChange} />, hasSave: true },
    reminders: { title: 'Bill Reminders', component: <BillReminders settings={formData} onSettingsChange={handleFormChange} />, hasSave: true },
    data: { title: 'Data & Tools', component: <DataManagement requestConfirmation={props.requestConfirmation} onOpenCsvImporter={props.onOpenCsvImporter} onOpenQrImporter={props.onOpenQrImporter} bills={props.bills} importedBills={props.importedBills} /> },
    sync: { title: 'Sync Devices', component: <DataSync onNavigate={() => { onClose(); props.onNavigate(View.Sync); }} /> },
    subscription: { title: 'Subscription', component: <SubscriptionManagement onNavigate={props.onNavigate} onGoToManageSubscriptionPage={() => props.onNavigate(View.ManageSubscription)} /> },
    danger: { title: 'Danger Zone', component: <DangerZone requestConfirmation={props.requestConfirmation} /> },
    about: { title: 'About & Support', component: <AboutSupport showDebugConsole={props.showDebugConsole} onToggleDebugConsole={props.toggleDebugConsole} /> },
  };

  const currentSection = sectionConfig[activeSection];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={handleCancel} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 id="settings-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">{currentSection.title}</h2>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          {currentSection.component}
        </div>
        {currentSection.hasSave && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4 flex-shrink-0">
            <button onClick={handleCancel} className="px-5 py-2.5 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">
              {isDirty ? 'Cancel' : 'Close'}
            </button>
            {isDirty && (
              <button onClick={handleSave} className="px-5 py-2.5 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">
                Save Changes
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
