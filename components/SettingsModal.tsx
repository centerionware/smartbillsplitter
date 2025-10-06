import React, { useState, useEffect } from 'react';
import { View } from '../types';
import type { Settings, Theme, RequestConfirmationFn, SettingsSection, Bill, ImportedBill, Category } from '../types';
import Personalization from './settings/Personalization';
import PaymentIntegrations from './settings/PaymentIntegrations';
import BillReminders from './settings/BillReminders';
import DataManagement from './settings/DataManagement';
import DataSync from './settings/DataSync';
import DangerZone from './settings/DangerZone';
import SubscriptionManagement from './settings/SubscriptionManagement';
import { useAppControl } from '../contexts/AppControlContext';
import AboutSupport from './settings/AboutSupport';
import { DisclaimerContent } from './DisclaimerContent';
import BudgetingSettings from './settings/BudgetingSettings';

interface SettingsModalProps {
  activeSection: SettingsSection;
  onClose: () => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  categories: Category[];
  saveCategories: (categories: Category[]) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
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
  const { activeSection, onClose, settings, updateSettings, categories, saveCategories } = props;
  const [localSettings, setLocalSettings] = useState(settings);
  const [localCategories, setLocalCategories] = useState<Category[]>(() => JSON.parse(JSON.stringify(categories)));
  const [isDirty, setIsDirty] = useState(false);
  const { showNotification } = useAppControl();

  useEffect(() => {
    setLocalSettings(settings);
    setLocalCategories(JSON.parse(JSON.stringify(categories)));
    setIsDirty(false);
  }, [settings, categories, activeSection]);

  const handleSettingsChange = (newValues: Partial<Settings>) => {
    setLocalSettings(prev => ({ ...prev, ...newValues }));
    setIsDirty(true);
  };
  
  const handleCategoriesChange = (newCategories: Category[]) => {
    setLocalCategories(newCategories);
    setIsDirty(true);
  };

  const handlePaymentDetailsChange = (newDetails: Partial<Settings['paymentDetails']>) => {
    setLocalSettings(prev => ({ ...prev, paymentDetails: { ...prev.paymentDetails, ...newDetails }}));
    setIsDirty(true);
  };
  
  const handleSave = async () => {
    // Filter out new categories that were added but left empty
    const finalCategories = localCategories.filter(cat => cat.name.trim() !== '');
    
    await updateSettings(localSettings);
    await saveCategories(finalCategories);

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
    personalization: { title: 'Personalization', component: <Personalization settings={localSettings} onSettingsChange={handleSettingsChange} theme={props.theme} setTheme={props.setTheme} />, hasSave: true },
    payments: { title: 'Payment Methods', component: <PaymentIntegrations settings={localSettings} onPaymentDetailsChange={handlePaymentDetailsChange} />, hasSave: true },
    reminders: { title: 'Bill Reminders', component: <BillReminders settings={localSettings} onSettingsChange={handleSettingsChange} />, hasSave: true },
    budgeting: { title: 'Budgeting', component: <BudgetingSettings settings={localSettings} onSettingsChange={handleSettingsChange} categories={localCategories} onCategoriesChange={handleCategoriesChange} />, hasSave: true },
    data: { title: 'Data & Tools', component: <DataManagement requestConfirmation={props.requestConfirmation} onOpenCsvImporter={props.onOpenCsvImporter} onOpenQrImporter={props.onOpenQrImporter} bills={props.bills} importedBills={props.importedBills} /> },
    sync: { title: 'Sync Devices', component: <DataSync onNavigate={() => { onClose(); props.onNavigate(View.Sync); }} /> },
    subscription: { title: 'Subscription', component: <SubscriptionManagement onNavigate={props.onNavigate} onGoToManageSubscriptionPage={() => props.onNavigate(View.ManageSubscription)} /> },
    danger: { title: 'Danger Zone', component: <DangerZone requestConfirmation={props.requestConfirmation} /> },
    about: { title: 'About & Support', component: <AboutSupport showDebugConsole={props.showDebugConsole} onToggleDebugConsole={props.toggleDebugConsole} /> },
    disclaimer: { title: 'Disclaimer & Privacy', component: <DisclaimerContent /> },
  };

  const currentSection = sectionConfig[activeSection];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={handleCancel} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
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
