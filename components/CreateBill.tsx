import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Bill, Participant, ReceiptItem, SplitMode, Settings, RecurringBill, RecurrenceRule, Group, Category } from '../types';
import ReceiptScanner from './ReceiptScanner';
import ItemEditor from './ItemEditor';
import AdditionalInfoEditor from './AdditionalInfoEditor';
import RecurrenceSelector from './RecurrenceSelector';
import SetupDisplayNameModal from './SetupDisplayNameModal';
import { useAppControl } from '../contexts/AppControlContext';
import { matchAndAssignItems } from '../services/geminiService';
import BillPrimaryDetails from './BillPrimaryDetails';
import BillSplitMethod from './BillSplitMethod';
import BillParticipants from './BillParticipants';
import BillExtraDetails from './BillExtraDetails';
import SelectGroupModal from './modals/SelectGroupModal';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const getStepFromHash = () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const stepParam = params.get('step');
    if (stepParam === '1.5') return 1.5;
    return parseFloat(stepParam || '0');
};

interface CreateBillProps {
  onSaveBill: (bill: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => void;
  onSaveRecurringBill: (bill: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => void;
  onUpdateRecurringBill: (bill: RecurringBill) => void;
  onBack: () => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  recurringBillToEdit?: RecurringBill;
  fromTemplate?: RecurringBill;
  billConversionSource?: Bill;
  groups: Group[];
  categories: Category[];
}

const CreateBill: React.FC<CreateBillProps> = ({
  onSaveBill, onSaveRecurringBill, onUpdateRecurringBill, onBack,
  settings, updateSettings, recurringBillToEdit, fromTemplate, billConversionSource, groups, categories
}) => {
  const initialState = recurringBillToEdit || fromTemplate || billConversionSource;
  const isEditingTemplate = !!recurringBillToEdit;
  const isFromTemplate = !!fromTemplate;
  const isConverting = !!billConversionSource;
  const isRecurring = isEditingTemplate || isConverting;

  const [step, setStepState] = useState(isEditingTemplate || isConverting ? 2 : (groups.length > 0 ? 0 : 1));
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const { showNotification } = useAppControl();
  
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isSelectGroupModalOpen, setIsSelectGroupModalOpen] = useState(false);

  const setStep = (newStep: number | string) => {
    setStepState(parseFloat(String(newStep)));
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const baseHash = window.location.hash.split('?')[0];
    if (newStep === 1 || newStep === 0) params.delete('step');
    else params.set('step', String(newStep));
    const newQuery = params.toString();
    window.history.replaceState(null, '', newQuery ? `${baseHash}?${newQuery}` : baseHash);
  };

  useEffect(() => {
    const handleHashChange = () => {
        const stepFromHash = getStepFromHash();
        if (step !== stepFromHash) setStepState(stepFromHash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [step]);

  const [description, setDescription] = useState(initialState?.description || '');
  const [totalAmount, setTotalAmount] = useState<number | undefined>(initialState?.totalAmount);
  const [date, setDate] = useState(billConversionSource?.date ? billConversionSource.date.split('T')[0] : getTodayDateString());
  const [participants, setParticipants] = useState<Participant[]>(initialState?.participants || [{ id: 'p1', name: settings.myDisplayName, amountOwed: 0, paid: true, splitValue: 0 }]);
  const [splitMode, setSplitMode] = useState<SplitMode>( (initialState as RecurringBill)?.splitMode || (initialState?.items && initialState.items.length > 0 ? 'item' : 'equally'));
  const [items, setItems] = useState<ReceiptItem[]>(initialState?.items || []);
  const [receiptImage, setReceiptImage] = useState<string | undefined>(initialState?.receiptImage);
  const [additionalInfo, setAdditionalInfo] = useState<{ id: string, key: string, value: string }[]>(
    initialState?.additionalInfo ? Object.entries(initialState.additionalInfo).map(([key, value], i) => ({ id: `info-${i}`, key, value })) : []
  );
  const [categoryId, setCategoryId] = useState<string | undefined>(initialState?.categoryId);
  
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(
    (initialState as RecurringBill)?.recurrenceRule || { frequency: 'monthly', interval: 1, dayOfMonth: new Date().getDate() }
  );

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [isInfoEditorOpen, setIsInfoEditorOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  useEffect(() => {
    const activeParticipants = participants.filter(p => p.name.trim() !== '');
    if (activeParticipants.length === 0) return;
    let newParticipants = [...participants];
    switch (splitMode) {
      case 'equally': {
        const amount = (totalAmount || 0) / activeParticipants.length;
        newParticipants = participants.map(p => ({ ...p, amountOwed: p.name.trim() ? parseFloat(amount.toFixed(2)) : 0 }));
        break;
      }
      case 'amount':
        newParticipants = participants.map(p => ({ ...p, amountOwed: p.splitValue || 0 }));
        break;
      case 'percentage': {
        const totalPercentage = participants.reduce((sum, p) => sum + (p.splitValue || 0), 0);
        newParticipants = participants.map(p => ({ ...p, amountOwed: totalPercentage > 0 ? parseFloat(((totalAmount || 0) * ((p.splitValue || 0) / totalPercentage)).toFixed(2)) : 0 }));
        break;
      }
      case 'item': {
        newParticipants = participants.map(p => {
          let total = items.reduce((sum, item) => sum + (item.assignedTo.includes(p.id) ? (item.price / (item.assignedTo.length || 1)) : 0), 0);
          return { ...p, amountOwed: parseFloat(total.toFixed(2)) };
        });
        break;
      }
    }
    if (splitMode !== 'item') {
        const totalOwed = newParticipants.reduce((sum, p) => sum + p.amountOwed, 0);
        const diff = (totalAmount || 0) - totalOwed;
        if (Math.abs(diff) > 0.001 && newParticipants.length > 0) {
            const firstActive = newParticipants.findIndex(p => p.name.trim());
            if (firstActive !== -1) newParticipants[firstActive].amountOwed = parseFloat((newParticipants[firstActive].amountOwed + diff).toFixed(2));
        }
    }
    if (JSON.stringify(newParticipants) !== JSON.stringify(participants)) setParticipants(newParticipants);
  }, [totalAmount, splitMode, items, participants]);

  useEffect(() => {
    if (isFromTemplate && fromTemplate) setParticipants(fromTemplate.participants.map(p => ({ ...p, paid: false })));
  }, [isFromTemplate, fromTemplate]);

  useEffect(() => {
    if (!settings.myDisplayName || settings.myDisplayName.trim().toLowerCase() === 'myself') setIsSetupModalOpen(true);
    else setIsSetupModalOpen(false);
  }, [settings.myDisplayName]);

  const handleSaveDisplayName = async (name: string) => {
    const oldName = settings.myDisplayName.trim().toLowerCase();
    await updateSettings({ myDisplayName: name });
    setParticipants(prev => prev.map(p => p.name.trim().toLowerCase() === oldName ? { ...p, name } : p));
  };
  
  const validateAndSave = () => {
    if (splitMode === 'item' && items.some(item => item.assignedTo.length === 0)) {
        showNotification('Please assign all items to a participant before saving.', 'error');
        setIsItemEditorOpen(true);
        return;
    }
    if (!validateStep(4)) return;
    const finalParticipants = participants.map(p => ({...p, name: p.name.trim()}));
    const additionalInfoRecord = additionalInfo.reduce((acc, item) => {
        if (item.key.trim()) acc[item.key.trim()] = item.value;
        return acc;
    }, {} as Record<string, string>);
    if (isRecurring) {
        const recurringData = { description, totalAmount: totalAmount || 0, participants: finalParticipants, items, receiptImage, additionalInfo: additionalInfoRecord, splitMode, recurrenceRule, groupId: selectedGroupId || undefined, categoryId };
        if (isEditingTemplate && recurringBillToEdit) {
            onUpdateRecurringBill({ ...recurringBillToEdit, ...recurringData });
        } else {
            onSaveRecurringBill(recurringData);
        }
    } else {
        const data = { description, totalAmount: totalAmount || 0, date, participants: finalParticipants, items, receiptImage, additionalInfo: additionalInfoRecord, groupId: selectedGroupId || undefined, categoryId };
        onSaveBill(data, fromTemplate?.id);
    }
    onBack();
  };

  const handleItemsScanned = async (data: any) => {
    setDescription(data.description || '');
    if (data.date && !isRecurring) setDate(data.date);
    if (data.additionalInfo) setAdditionalInfo(data.additionalInfo.map((info: any, i: number) => ({ id: `info-scan-${i}`, ...info })));
    const scannedItems: { name: string; price: number }[] = data.items.map((item: any) => ({ name: item.name, price: item.price }));
    setTotalAmount(scannedItems.reduce((sum, item) => sum + (item.price || 0), 0));
    const newItems = (items: { name: string; price: number }[], assignments: string[]): ReceiptItem[] => items.map((item, i) => ({ ...item, id: `item-scan-${i}`, assignedTo: assignments }));
    
    if (isFromTemplate && fromTemplate) {
        if (fromTemplate.splitMode !== 'item') {
            setItems(newItems(scannedItems, []));
            setSplitMode(fromTemplate.splitMode);
        } else {
            setIsProcessingAI(true);
            try {
                const assigned = await matchAndAssignItems({ templateItems: fromTemplate.items || [], scannedItems, participants });
                setItems(assigned);
                setSplitMode('item');
            } catch (e: any) {
                showNotification(`AI item matching failed: ${e.message}. Assign manually.`, 'error');
                setItems(newItems(scannedItems, []));
                setSplitMode('item');
            } finally { setIsProcessingAI(false); }
        }
    } else {
        const self = participants.find(p => p.name.toLowerCase().trim() === settings.myDisplayName.toLowerCase().trim());
        const assignTo = selectedGroupId ? [] : (self ? [self.id] : []);
        setItems(newItems(scannedItems, assignTo));
        setSplitMode('item');
    }
    setStep(2);
  };

  const totalFromItems = useMemo(() => items.reduce((sum, item) => sum + (item.price || 0), 0), [items]);
  useEffect(() => { if (splitMode === 'item') setTotalAmount(totalFromItems); }, [items, splitMode, totalFromItems]);

  const validateStep = (currentStep: number) => {
    const newErrors: { [key: string]: string } = {};
    if (currentStep >= 2) {
      if (!description.trim()) newErrors.description = "Description is required.";
      if (!isRecurring && (!totalAmount || totalAmount <= 0) && splitMode !== 'item') newErrors.totalAmount = "Total amount must be greater than zero.";
    }
    if (currentStep >= 3) {
      if (participants.some(p => !p.name.trim())) newErrors.participants = "All participants must have a name.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleNext = (nextStep: number) => { if (validateStep(step)) setStep(nextStep); };

  const handleGroupSelect = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        setSelectedGroupId(group.id);
        setParticipants(group.participants.map(p => ({ ...p, paid: false, amountOwed: 0 })));
        setSplitMode(group.defaultSplit.mode);
        if (group.defaultSplit.splitValues) {
            setParticipants(group.participants.map(p => ({
                ...p,
                paid: false,
                amountOwed: 0,
                splitValue: group.defaultSplit.splitValues![p.id] || 0
            })));
        }
    }
    setIsSelectGroupModalOpen(false);
    setStep(1);
  };

  const renderGroupSelectionStep = () => {
    if (groups.length > 5) {
        return (
            <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-6">Start with a Group?</h3>
                <button 
                    type="button" 
                    onClick={() => setIsSelectGroupModalOpen(true)} 
                    className="w-full px-6 py-4 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 mb-4 text-lg"
                >
                    Select Group
                </button>
                <button 
                    type="button" 
                    onClick={() => setStep(1)} 
                    className="w-full px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                    Continue without a Group
                </button>
            </div>
        );
    }

    return (
        <div className="text-center">
          <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-6">Start with a Group?</h3>
          <div className="space-y-4 mb-6">
            {groups.map(group => (
                <button key={group.id} type="button" onClick={() => handleGroupSelect(group.id)} className="w-full text-left p-4 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <p className="font-bold text-lg">{group.name}</p>
                    <p className="text-sm text-slate-500">{group.participants.length} members</p>
                </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep(1)} className="w-full px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
            Continue without a Group
          </button>
        </div>
    );
  };

  const renderStartModeStep = () => ( <div className="text-center"> <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-6">How do you want to start?</h3> <div className="flex flex-col sm:flex-row gap-6"> <button type="button" onClick={() => setStep(1.5) } className="flex-1 p-8 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all transform hover:-translate-y-1"> <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}> <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /> </svg> <h4 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Scan a Receipt</h4> <p className="mt-1 text-slate-500 dark:text-slate-400">Use AI to automatically add items.</p> </button> <button type="button" onClick={() => setStep(2) } className="flex-1 p-8 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all transform hover:-translate-y-1"> <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}> <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /> </svg> <h4 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Enter Manually</h4> <p className="mt-1 text-slate-500 dark:text-slate-400">Add the bill details yourself.</p> </button> </div> </div> );
  const renderScanStep = () => <ReceiptScanner onItemsScanned={handleItemsScanned} onImageSelected={setReceiptImage} onImageCleared={() => setReceiptImage(undefined)} isForTemplate={isRecurring} />;
  const renderPrimaryDetailsStep = () => ( <div className="space-y-6"> <BillPrimaryDetails description={description} setDescription={setDescription} totalAmount={totalAmount} setTotalAmount={setTotalAmount} date={date} setDate={setDate} isRecurring={isRecurring} splitMode={splitMode} errors={errors} /> 
    <div>
        <label htmlFor="category" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Category (Optional)</label>
        <select
            id="category"
            value={categoryId || ''}
            onChange={e => setCategoryId(e.target.value || undefined)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
        >
            <option value="">Uncategorized</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
    </div>
  <div className="mt-8 flex justify-end space-x-4"> <button type="button" onClick={() => setStep(selectedGroupId ? 0 : 1)} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Back</button> <button type="button" onClick={() => handleNext(3)} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Next</button> </div> </div> );
  const renderParticipantsStep = () => ( <div className="space-y-6"> <BillSplitMethod splitMode={splitMode} setSplitMode={setSplitMode} /> <BillParticipants participants={participants} setParticipants={setParticipants} splitMode={splitMode} participantsError={errors.participants} /> <div className="mt-8 flex justify-between space-x-4"> <button type="button" onClick={() => window.history.back()} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Back</button> <button type="button" onClick={() => handleNext(4)} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Next</button> </div> </div> );
  const renderExtrasStep = () => ( <div className="space-y-6"> {isRecurring && <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />} <BillExtraDetails items={items} additionalInfo={additionalInfo} onEditItems={() => setIsItemEditorOpen(true)} onEditInfo={() => setIsInfoEditorOpen(true)} isRecurring={isRecurring} receiptImage={receiptImage} onReceiptImageChange={setReceiptImage} /> <div className="mt-8 flex justify-between space-x-4"> <button type="button" onClick={() => window.history.back()} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Back</button> <button type="button" onClick={validateAndSave} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">{isEditingTemplate ? 'Update Template' : 'Save Bill'}</button> </div> </div> );

  const getTitle = () => {
    if (isEditingTemplate) return 'Edit Template';
    if (isFromTemplate) return 'Create Bill from Template';
    if (isConverting) return 'Convert to Template';
    return 'Create New Bill';
  }

  const renderContent = () => {
      if (isEditingTemplate || isConverting) {
          switch(step) {
              case 2: return renderPrimaryDetailsStep();
              case 3: return renderParticipantsStep();
              case 4: return renderExtrasStep();
              default: setStep(2); return renderPrimaryDetailsStep();
          }
      }
      switch(step) {
          case 0: return renderGroupSelectionStep();
          case 1: return renderStartModeStep();
          case 1.5: return renderScanStep();
          case 2: return renderPrimaryDetailsStep();
          case 3: return renderParticipantsStep();
          case 4: return renderExtrasStep();
          default: return renderStartModeStep();
      }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {isSetupModalOpen && <SetupDisplayNameModal onSave={handleSaveDisplayName} currentName={settings.myDisplayName} />}
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          Back
      </button>

      <form onSubmit={e => { e.preventDefault(); validateAndSave(); }} className="space-y-6 relative">
        {isProcessingAI && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-10 flex flex-col items-center justify-center rounded-lg">
                <svg className="animate-spin h-10 w-10 text-teal-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <h1 className="text-xl font-semibold text-slate-700 dark:text-slate-200">AI is matching items from your template...</h1>
            </div>
        )}
        <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200">{getTitle()}</h2>
        {renderContent()}
      </form>
      
      {isItemEditorOpen && <ItemEditor initialItems={items} participants={participants} onSave={(newItems) => { setItems(newItems); setIsItemEditorOpen(false); }} onCancel={() => setIsItemEditorOpen(false)} isRecurring={isRecurring} />}
      {isInfoEditorOpen && <AdditionalInfoEditor initialInfo={additionalInfo} onSave={(newInfo) => { setAdditionalInfo(newInfo); setIsInfoEditorOpen(false); }} onCancel={() => setIsInfoEditorOpen(false)} />}
      
      {isSelectGroupModalOpen && (
        <SelectGroupModal 
            isOpen={isSelectGroupModalOpen}
            onClose={() => setIsSelectGroupModalOpen(false)}
            groups={groups}
            onSelect={handleGroupSelect}
        />
    )}
    </div>
  );
};

export default CreateBill;
