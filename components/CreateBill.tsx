import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Bill, Participant, ReceiptItem, SplitMode, Settings, RecurringBill, RecurrenceRule } from '../types';
import ReceiptScanner from './ReceiptScanner.tsx';
import ItemEditor from './ItemEditor.tsx';
import AdditionalInfoEditor from './AdditionalInfoEditor.tsx';
import RecurrenceSelector from './RecurrenceSelector.tsx';
import SetupDisplayNameModal from './SetupDisplayNameModal.tsx';
import { useAppControl } from '../contexts/AppControlContext.tsx';
import { matchAndAssignItems } from '../services/geminiService.ts';
// Child components for better structure
import BillPrimaryDetails from './BillPrimaryDetails.tsx';
import BillSplitMethod from './BillSplitMethod.tsx';
import BillParticipants from './BillParticipants.tsx';
import BillExtraDetails from './BillExtraDetails.tsx';

// A minimal utility to create a date string in YYYY-MM-DD format
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStepFromHash = () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const stepParam = params.get('step');
    if (stepParam === '1.5') return 1.5;
    return parseInt(stepParam || '1', 10);
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
}

const CreateBill: React.FC<CreateBillProps> = ({
  onSaveBill,
  onSaveRecurringBill,
  onUpdateRecurringBill,
  onBack,
  settings,
  updateSettings,
  recurringBillToEdit,
  fromTemplate,
  billConversionSource,
}) => {
  const initialState = recurringBillToEdit || fromTemplate || billConversionSource;
  const isEditingTemplate = !!recurringBillToEdit;
  const isFromTemplate = !!fromTemplate;
  const isConverting = !!billConversionSource;
  const isRecurring = isEditingTemplate || isConverting;

  const [step, setStepState] = useState(getStepFromHash());
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const { showNotification } = useAppControl();

  const setStep = (newStep: number) => {
    setStepState(newStep);
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const baseHash = window.location.hash.split('?')[0];

    if (newStep === 1) {
        params.delete('step');
    } else {
        params.set('step', String(newStep));
    }

    const newQuery = params.toString();
    // Use replaceState to avoid polluting history for simple step changes
    window.history.replaceState(null, '', newQuery ? `${baseHash}?${newQuery}` : baseHash);
  };

  useEffect(() => {
    const handleHashChange = () => {
        const stepFromHash = getStepFromHash();
        if (step !== stepFromHash) {
            setStepState(stepFromHash);
        }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
        window.removeEventListener('hashchange', handleHashChange);
    };
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
  
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(
    (initialState as RecurringBill)?.recurrenceRule || { frequency: 'monthly', interval: 1, dayOfMonth: new Date().getDate() }
  );

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [isInfoEditorOpen, setIsInfoEditorOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // This effect recalculates owed amounts whenever the split logic changes.
  useEffect(() => {
    // Only calculate for participants with names.
    const activeParticipants = participants.filter(p => p.name.trim() !== '');
    if (activeParticipants.length === 0) return;

    let newParticipants = [...participants];

    switch (splitMode) {
      case 'equally': {
        const amountPerPerson = (totalAmount || 0) / activeParticipants.length;
        newParticipants = participants.map(p => ({
          ...p,
          amountOwed: p.name.trim() !== '' ? parseFloat(amountPerPerson.toFixed(2)) : 0,
        }));
        break;
      }
      case 'amount':
        newParticipants = participants.map(p => ({
          ...p,
          amountOwed: p.splitValue || 0,
        }));
        break;
      case 'percentage': {
        const totalPercentage = participants.reduce((sum, p) => sum + (p.splitValue || 0), 0);
        if (totalPercentage > 0) {
          newParticipants = participants.map(p => ({
            ...p,
            amountOwed: parseFloat(((totalAmount || 0) * ((p.splitValue || 0) / totalPercentage)).toFixed(2)),
          }));
        } else {
          newParticipants = participants.map(p => ({ ...p, amountOwed: 0 }));
        }
        break;
      }
      case 'item': {
        newParticipants = participants.map(p => {
          let totalOwedByParticipant = 0;
          items.forEach(item => {
            if (item.assignedTo.includes(p.id)) {
              const share = item.price / (item.assignedTo.length || 1);
              totalOwedByParticipant += share;
            }
          });
          return { ...p, amountOwed: parseFloat(totalOwedByParticipant.toFixed(2)) };
        });
        break;
      }
    }

    // Correct for rounding errors by assigning the remainder to the first participant.
    // This is not done for 'item' mode, as the total is derived from item prices.
    if (splitMode !== 'item') {
        const currentTotalOwed = newParticipants.reduce((sum, p) => sum + p.amountOwed, 0);
        const difference = (totalAmount || 0) - currentTotalOwed;
        
        if (Math.abs(difference) > 0.001 && newParticipants.length > 0) {
            const firstActiveParticipantIndex = newParticipants.findIndex(p => p.name.trim() !== '');
            if (firstActiveParticipantIndex !== -1) {
                newParticipants[firstActiveParticipantIndex].amountOwed += difference;
                // Ensure it's still 2 decimal places
                newParticipants[firstActiveParticipantIndex].amountOwed = parseFloat(newParticipants[firstActiveParticipantIndex].amountOwed.toFixed(2));
            }
        }
    }

    // Only update state if there's an actual change to prevent infinite loops
    if (JSON.stringify(newParticipants) !== JSON.stringify(participants)) {
      setParticipants(newParticipants);
    }
  }, [totalAmount, splitMode, items, participants]);


  useEffect(() => {
    if (isFromTemplate && fromTemplate) {
      // When creating from a template, all participants should start as unpaid.
      const newParticipants = fromTemplate.participants.map(p => ({
        ...p,
        paid: false,
      }));
      setParticipants(newParticipants);
    }
  }, [isFromTemplate, fromTemplate]);

  useEffect(() => {
    if (!settings.myDisplayName || settings.myDisplayName.trim().toLowerCase() === 'myself') {
        setIsSetupModalOpen(true);
    } else {
        setIsSetupModalOpen(false);
    }
  }, [settings.myDisplayName]);

  const handleSaveDisplayName = async (name: string) => {
    const oldDisplayName = settings.myDisplayName;
    const oldDisplayNameLower = oldDisplayName.trim().toLowerCase();
    await updateSettings({ myDisplayName: name });
    // Immediately update the local participants state to use the new name.
    // This prevents a race condition where the bill is saved before the `settings` prop updates.
    setParticipants(prev => {
        return prev.map(p => {
            if (p.name.trim().toLowerCase() === oldDisplayNameLower) {
                return { ...p, name: name };
            }
            return p;
        });
    });
  };
  
  const validateAndSave = () => {
    if (!validateStep(4)) return;

    const finalParticipants = participants.map(p => ({...p, name: p.name.trim()}));

    const additionalInfoRecord = additionalInfo.reduce((acc, item) => {
        if (item.key.trim()) acc[item.key.trim()] = item.value;
        return acc;
    }, {} as Record<string, string>);

    if (isRecurring) {
        const recurringBillData = {
            description,
            totalAmount,
            participants: finalParticipants,
            items,
            receiptImage,
            additionalInfo: additionalInfoRecord,
            splitMode,
            recurrenceRule,
        };
        if (isEditingTemplate && recurringBillToEdit) {
            onUpdateRecurringBill({ ...recurringBillToEdit, ...recurringBillData });
        } else {
            onSaveRecurringBill(recurringBillData);
        }
    } else {
        const billData = {
            description,
            totalAmount: totalAmount || 0,
            date,
            participants: finalParticipants,
            items,
            receiptImage,
            additionalInfo: additionalInfoRecord
        };
        onSaveBill(billData, fromTemplate?.id);
    }
    onBack();
  };

  const handleItemsScanned = async (data: any) => {
    setDescription(data.description || '');
    if (data.date && !isRecurring) {
        setDate(data.date);
    }

    if (data.additionalInfo && Array.isArray(data.additionalInfo)) {
        const newAdditionalInfo = data.additionalInfo.map((info: {key: string; value: string}, index: number) => ({
            id: `info-scanned-${Date.now()}-${index}`,
            key: info.key,
            value: info.value,
        }));
        setAdditionalInfo(newAdditionalInfo);
    }

    const scannedItems: { name: string; price: number }[] = data.items.map((item: any) => ({
      name: item.name,
      price: item.price,
    }));
    
    const newTotalFromScan = scannedItems.reduce((sum, item) => sum + (item.price || 0), 0);
    setTotalAmount(newTotalFromScan);

    if (isFromTemplate && fromTemplate) {
        if (fromTemplate.splitMode !== 'item') {
            const newItems: ReceiptItem[] = scannedItems.map((item, index) => ({
                ...item,
                id: `item-scanned-${Date.now()}-${index}`,
                assignedTo: [],
            }));
            setItems(newItems);
            setSplitMode(fromTemplate.splitMode);
        } else {
            setIsProcessingAI(true);
            try {
                const assignedItems = await matchAndAssignItems({
                    templateItems: fromTemplate.items || [],
                    scannedItems: scannedItems,
                    participants: participants,
                });
                setItems(assignedItems);
                setSplitMode('item');
            } catch (e: any) {
                showNotification(`AI item matching failed: ${e.message}. Please assign items manually.`, 'error');
                const newItems: ReceiptItem[] = scannedItems.map((item, index) => ({
                    ...item,
                    id: `item-scanned-${Date.now()}-${index}`,
                    assignedTo: [],
                }));
                setItems(newItems);
                setSplitMode('item');
            } finally {
                setIsProcessingAI(false);
            }
        }
    } else {
        // FIX: When scanning a new receipt, automatically assign all items to the current user.
        const selfParticipant = participants.find(p => p.name.toLowerCase().trim() === settings.myDisplayName.toLowerCase().trim());
        const selfId = selfParticipant ? selfParticipant.id : null;

        const newItems: ReceiptItem[] = scannedItems.map((item, index) => ({
            ...item,
            id: `item-scanned-${Date.now()}-${index}`,
            assignedTo: selfId ? [selfId] : [],
        }));
        setItems(newItems);
        setSplitMode('item');
    }
    setStep(2);
  };

  const totalFromItems = useMemo(() => items.reduce((sum, item) => sum + (item.price || 0), 0), [items]);

  useEffect(() => {
    // This effect is now primarily for manual item editing.
    // Scans will set the total amount directly.
    if (splitMode === 'item') {
      setTotalAmount(totalFromItems);
    }
  }, [items, splitMode, totalFromItems]);

  const validateStep = (currentStep: number) => {
    const newErrors: { [key: string]: string } = {};
    if (currentStep >= 2) {
      if (!description.trim()) newErrors.description = "Description is required.";
      if (!isRecurring && (!totalAmount || totalAmount <= 0)) newErrors.totalAmount = "Total amount must be greater than zero.";
    }
    if (currentStep >= 3) {
      if (participants.some(p => !p.name.trim())) newErrors.participants = "All participants must have a name.";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleNext = (nextStep: number) => {
    if (validateStep(step)) {
      setStep(nextStep);
    }
  };

  const renderStartModeStep = () => (
    <div className="text-center">
      <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-6">How do you want to start?</h3>
      <div className="flex flex-col sm:flex-row gap-6">
        <button
          type="button"
          onClick={() => setStep(1.5) }
          className="flex-1 p-8 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all transform hover:-translate-y-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h4 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Scan a Receipt</h4>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Use AI to automatically add items.</p>
        </button>
        <button
          type="button"
          onClick={() => setStep(2) }
          className="flex-1 p-8 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all transform hover:-translate-y-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <h4 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">Enter Manually</h4>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Add the bill details yourself.</p>
        </button>
      </div>
    </div>
  );

  const renderScanStep = () => (
    <ReceiptScanner onItemsScanned={handleItemsScanned} onImageSelected={setReceiptImage} onImageCleared={() => setReceiptImage(undefined)} isForTemplate={isRecurring} />
  );

  const renderPrimaryDetailsStep = () => (
     <div className="space-y-6">
        <BillPrimaryDetails description={description} setDescription={setDescription} totalAmount={totalAmount} setTotalAmount={setTotalAmount} date={date} setDate={setDate} isRecurring={isRecurring} splitMode={splitMode} errors={errors} />
        <div className="mt-8 flex justify-end space-x-4">
            <button type="button" onClick={() => setStep(1)} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Back</button>
            <button type="button" onClick={() => handleNext(3)} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Next</button>
        </div>
      </div>
  );

  const renderParticipantsStep = () => (
    <div className="space-y-6">
        <BillSplitMethod splitMode={splitMode} setSplitMode={setSplitMode} />
        <BillParticipants participants={participants} setParticipants={setParticipants} splitMode={splitMode} participantsError={errors.participants} />
        <div className="mt-8 flex justify-between space-x-4">
            <button type="button" onClick={() => window.history.back()} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Back</button>
            <button type="button" onClick={() => handleNext(4)} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Next</button>
        </div>
    </div>
  );
  
  const renderExtrasStep = () => (
    <div className="space-y-6">
        {isRecurring && <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />}
        <BillExtraDetails 
            items={items} 
            additionalInfo={additionalInfo} 
            onEditItems={() => setIsItemEditorOpen(true)} 
            onEditInfo={() => setIsInfoEditorOpen(true)} 
            isRecurring={isRecurring}
            receiptImage={receiptImage}
            onReceiptImageChange={setReceiptImage}
        />
         <div className="mt-8 flex justify-between space-x-4">
            <button type="button" onClick={() => window.history.back()} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Back</button>
            <button type="button" onClick={validateAndSave} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">{isEditingTemplate ? 'Update Template' : 'Save Bill'}</button>
        </div>
    </div>
  );

  const getTitle = () => {
    if (isEditingTemplate) return 'Edit Template';
    if (isFromTemplate) return 'Create Bill from Template';
    if (isConverting) return 'Convert to Template';
    return 'Create New Bill';
  }

  const renderContent = () => {
      if (isEditingTemplate || isConverting) { // Skip step 1 if editing/converting
          switch(step) {
              case 2: return renderPrimaryDetailsStep();
              case 3: return renderParticipantsStep();
              case 4: return renderExtrasStep();
              default: setStep(2); return renderPrimaryDetailsStep();
          }
      }
      switch(step) { // For new bills or from template, start at step 1
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
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
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
    </div>
  );
};

export default CreateBill;