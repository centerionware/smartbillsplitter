import React, { useState, useMemo, useEffect } from 'react';
import type { Bill, Participant, ReceiptItem, Settings, RecurringBill, RecurrenceRule, SplitMode } from '../types.ts';
import type { RequestConfirmationFn } from '../App.tsx';
import ReceiptScanner from './ReceiptScanner.tsx';
import ItemEditor from './ItemEditor.tsx';
import RecurrenceSelector from './RecurrenceSelector.tsx';
import AdditionalInfoEditor from './AdditionalInfoEditor.tsx';

interface CreateBillProps {
  onSave: (bill: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => void;
  onSaveRecurring: (bill: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => void;
  onUpdateRecurring: (bill: RecurringBill) => void;
  onCancel: () => void;
  requestConfirmation: RequestConfirmationFn;
  settings: Settings;
  billTemplate: RecurringBill | { forEditing: RecurringBill } | null;
}

const CreateBill: React.FC<CreateBillProps> = ({
  onSave,
  onSaveRecurring,
  onUpdateRecurring,
  onCancel,
  requestConfirmation,
  settings,
  billTemplate,
}) => {
  const { mode, initialData } = useMemo(() => {
    if (billTemplate) {
      if ('forEditing' in billTemplate) return { mode: 'edit-recurring' as const, initialData: billTemplate.forEditing };
      return { mode: 'create-from-recurring' as const, initialData: billTemplate };
    }
    return { mode: 'create' as const, initialData: null };
  }, [billTemplate]);

  // --- State Initialization ---
  const [description, setDescription] = useState(initialData?.description || '');
  const [totalAmount, setTotalAmount] = useState<string>(
    (mode === 'edit-recurring' && initialData?.totalAmount) 
      ? initialData.totalAmount.toString() 
      : ''
  );
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [participants, setParticipants] = useState<Participant[]>(
      initialData?.participants || [{ id: `p-${Date.now()}`, name: settings.myDisplayName, amountOwed: 0, paid: true, splitValue: 0 }]
  );
  const [items, setItems] = useState<ReceiptItem[]>(initialData?.items || []);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  
  const [additionalInfo, setAdditionalInfo] = useState<{ id: string; key: string; value: string }[]>(() => {
    if (initialData?.additionalInfo) {
      return Object.entries(initialData.additionalInfo).map(([key, value], index) => ({
        id: `info-initial-${index}`,
        key,
        value,
      }));
    }
    return [];
  });

  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [isInfoEditorOpen, setIsInfoEditorOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitMode>(initialData?.splitMode || 'equally');

  const [isRecurring, setIsRecurring] = useState(mode === 'edit-recurring');
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(initialData?.recurrenceRule || {
    frequency: 'monthly', interval: 1, dayOfMonth: new Date().getDate(),
  });
  
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isContactPickerSupported, setIsContactPickerSupported] = useState(false);
  useEffect(() => { 'contacts' in navigator && 'ContactsManager' in window && setIsContactPickerSupported(true); }, []);

  const isDirty = useMemo(() => description !== '' || totalAmount !== '' || participants.length > 1 || items.length > 0 || additionalInfo.length > 0, [description, totalAmount, participants, items, additionalInfo]);
  
  useEffect(() => {
    if (mode === 'create-from-recurring' && initialData) {
      setDescription(initialData.description);
      setParticipants(initialData.participants.map(p => ({ ...p, id: `p-${Date.now()}-${Math.random()}` })));
      setItems(initialData.items.map(i => ({...i, id: `i-${Date.now()}-${Math.random()}`, price: 0})));
      setSplitMode(initialData.splitMode || (initialData.items.length > 0 ? 'item' : 'equally'));
      setIsRecurring(false); // We are creating a regular bill, not a template.
       if (initialData.totalAmount) {
        setTotalAmount(initialData.totalAmount.toString());
      }
      if (initialData.nextDueDate) {
        setDate(initialData.nextDueDate.split('T')[0]);
      }
    }
    if (mode === 'edit-recurring') {
      setIsRecurring(true);
    }
  }, [mode, initialData]);

  const itemizedTotal = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);
  const hasPricedItems = useMemo(() => items.some(i => i.price > 0), [items]);
  const effectiveTotal = useMemo(() => hasPricedItems ? itemizedTotal : parseFloat(totalAmount) || 0, [hasPricedItems, itemizedTotal, totalAmount]);
  
  useEffect(() => { if (hasPricedItems) setTotalAmount(itemizedTotal.toFixed(2)); }, [itemizedTotal, hasPricedItems]);

  const handleAddParticipant = () => setParticipants(prev => [...prev, { id: `p-${Date.now()}`, name: '', amountOwed: 0, paid: false, splitValue: 0 }]);
  const handleRemoveParticipant = (id: string) => { if (participants.length > 1) setParticipants(prev => prev.filter(p => p.id !== id)); };

  const isMyselfInList = useMemo(() => 
    participants.some(p => p.name.trim().toLowerCase() === settings.myDisplayName.trim().toLowerCase()),
    [participants, settings.myDisplayName]
  );
  
  const handleAddMyself = () => {
    if (isMyselfInList) return;
    setParticipants(prev => [...prev, { id: `p-${Date.now()}`, name: settings.myDisplayName, amountOwed: 0, paid: true, splitValue: 0 }]);
  };

  const handleParticipantChange = (id: string, field: 'name' | 'splitValue', value: string) => {
    setParticipants(prev => prev.map(p => {
        if (p.id === id) {
            if (field === 'name') return { ...p, name: value };
            if (field === 'splitValue') return { ...p, splitValue: parseFloat(value) || 0 };
        }
        return p;
    }));
  };
  
  const handleToggleAssignment = (itemId: string, participantId: string) => {
    setItems(currentItems => currentItems.map(item => {
        if (item.id === itemId) {
            const assignedTo = item.assignedTo.includes(participantId)
              ? item.assignedTo.filter(id => id !== participantId)
              : [...item.assignedTo, participantId];
            return { ...item, assignedTo };
        }
        return item;
    }));
  };

  const handleSelectContact = async (participantId: string) => {
    if (!isContactPickerSupported) return;
    try {
        // @ts-ignore
        const contacts = await navigator.contacts.select(['name'], { multiple: true });
        if (contacts.length === 0) return;

        setParticipants(prev => {
            let newParticipants = [...prev];
            const triggeringParticipantIndex = newParticipants.findIndex(p => p.id === participantId);
            let contactIndex = 0;
            if (triggeringParticipantIndex !== -1 && newParticipants[triggeringParticipantIndex].name.trim() === '' && contacts[0]?.name?.length > 0) {
                newParticipants[triggeringParticipantIndex].name = contacts[0].name[0];
                contactIndex = 1;
            }
            const participantsToAdd = contacts.slice(contactIndex).map((c, i) => ({
                id: `p-${Date.now()}-${i}`, name: c.name[0], amountOwed: 0, paid: false, splitValue: 0
            }));
            return [...newParticipants, ...participantsToAdd];
        });
    } catch (ex) { console.error("Error selecting contacts:", ex); }
  };
  
  const handleSplitModeChange = (newMode: SplitMode) => {
    setSplitMode(newMode);
    setParticipants(prev => prev.map(p => ({ ...p, splitValue: 0 })));
    if(newMode === 'item' && items.length === 0) {
        setIsItemEditorOpen(true);
    }
  };

  const participantsDeps = useMemo(() => JSON.stringify(
    participants.map(({ id, name, splitValue }) => ({ id, name, splitValue }))
  ), [participants]);
  
  const itemsDeps = useMemo(() => JSON.stringify(
      items.map(({ price, assignedTo }) => ({ price, assignedTo }))
  ), [items]);

  useEffect(() => {
    const activeParticipants = participants.filter(p => p.name.trim() !== '');
    if (activeParticipants.length === 0 || isRecurring) return;

    let newAmounts = new Map<string, number>();

    switch(splitMode) {
      case 'equally':
        const amountPerPerson = activeParticipants.length > 0 ? effectiveTotal / activeParticipants.length : 0;
        activeParticipants.forEach(p => newAmounts.set(p.id, amountPerPerson));
        break;
      case 'amount':
        participants.forEach(p => newAmounts.set(p.id, p.splitValue || 0));
        break;
      case 'percentage':
        participants.forEach(p => newAmounts.set(p.id, (effectiveTotal * (p.splitValue || 0)) / 100));
        break;
      case 'item':
        participants.forEach(p => newAmounts.set(p.id, 0));
        items.forEach(item => {
            const assignees = item.assignedTo.filter(pid => participants.some(p => p.id === pid && p.name.trim() !== ''));
            if (assignees.length > 0) {
                const amountPerAssignee = item.price / assignees.length;
                assignees.forEach(pid => {
                    newAmounts.set(pid, (newAmounts.get(pid) || 0) + amountPerAssignee);
                });
            }
        });
        break;
    }

    setParticipants(current => current.map(p => ({...p, amountOwed: newAmounts.get(p.id) || 0 })));
  }, [effectiveTotal, participantsDeps, splitMode, itemsDeps, isRecurring]);

  const handleTotalAmountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newTotal = parseFloat(e.target.value);
    const canDistribute = !isRecurring && newTotal > 0 && items.length > 0 && !hasPricedItems;
    if (!canDistribute) return;

    const totalInCents = Math.round(newTotal * 100);
    const numItems = items.length;
    const basePriceInCents = Math.floor(totalInCents / numItems);
    let remainderInCents = totalInCents % numItems;
    const updatedItems = items.map(item => {
        let finalPriceInCents = basePriceInCents;
        if (remainderInCents > 0) { finalPriceInCents++; remainderInCents--; }
        return { ...item, price: finalPriceInCents / 100 };
    });
    setItems(updatedItems);
  };

  const handleItemsScanned = (data: { description: string; date?: string; items: { name: string; price: number }[]; additionalInfo?: { key: string; value: string }[] }) => {
    if (data.description) setDescription(prev => prev || data.description);
    if (data.date) setDate(data.date);
    if (data.additionalInfo) {
      const infoArray = data.additionalInfo.map(({ key, value }, index) => ({
        id: `info-scan-${Date.now()}-${index}`,
        key,
        value,
      }));
      setAdditionalInfo(infoArray);
    }
    
    // Find 'myself' to auto-assign items
    const myself = participants.find(p => p.name.trim().toLowerCase() === settings.myDisplayName.trim().toLowerCase());
    const myselfId = myself ? [myself.id] : [];

    const newItems: ReceiptItem[] = data.items.map((item, index) => ({ 
      id: `item-scan-${Date.now()}-${index}`, 
      name: item.name, 
      price: item.price, 
      assignedTo: myselfId 
    }));
    
    setItems(newItems);
    setSplitMode('item');
  };
  
  const handleSaveItems = (updatedItems: ReceiptItem[]) => {
    setItems(updatedItems);
    setIsItemEditorOpen(false);
    if (!isRecurring && updatedItems.some(i => i.price > 0)) {
        setSplitMode('item');
    }
  };
  
  const handleSaveInfo = (updatedInfo: { id: string; key: string; value: string }[]) => {
    setAdditionalInfo(updatedInfo);
    setIsInfoEditorOpen(false);
  };

  const { splitTotal, splitRemainder, isSplitValid } = useMemo(() => {
    if (isRecurring) return { splitTotal: 0, splitRemainder: 0, isSplitValid: true };

    if (splitMode === 'amount') {
        const total = participants.reduce((sum, p) => sum + (p.splitValue || 0), 0);
        const remainder = effectiveTotal - total;
        return { splitTotal: total, splitRemainder: remainder, isSplitValid: Math.abs(remainder) < 0.01 };
    }
    if (splitMode === 'percentage') {
        const total = participants.reduce((sum, p) => sum + (p.splitValue || 0), 0);
        return { splitTotal: total, splitRemainder: 0, isSplitValid: Math.abs(total - 100) < 0.01 };
    }
    return { splitTotal: 0, splitRemainder: 0, isSplitValid: true };
  }, [splitMode, participants, effectiveTotal, isRecurring]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null); // Clear previous errors
    
    if (isRecurring) {
        const finalParticipants = participants.filter(p => p.name.trim() !== '').map(p => ({
            id: p.id,
            name: p.name,
            amountOwed: 0,
            paid: false,
            splitValue: (splitMode === 'amount' || splitMode === 'percentage') ? p.splitValue || 0 : undefined,
        }));
        
        const finalItems = items.map(({ price, ...i }) => ({
            ...i,
            price: 0,
            assignedTo: splitMode === 'item' ? i.assignedTo : [],
        })).filter(i => i.name.trim() !== '');

        // FIX: Calculate and include additionalInfo when saving a recurring bill.
        const finalAdditionalInfo = additionalInfo
            .filter(info => info.key.trim() !== '' && info.value.trim() !== '')
            .reduce((acc, { key, value }) => {
                acc[key.trim()] = value.trim();
                return acc;
            }, {} as Record<string, string>);

        const recurringBillData = {
            description,
            participants: finalParticipants,
            items: finalItems,
            recurrenceRule,
            splitMode,
            totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
            additionalInfo: Object.keys(finalAdditionalInfo).length > 0 ? finalAdditionalInfo : undefined,
        };
        if (mode === 'edit-recurring' && initialData) {
            onUpdateRecurring({ ...recurringBillData, id: initialData.id, status: initialData.status, nextDueDate: initialData.nextDueDate });
        } else {
            onSaveRecurring(recurringBillData);
        }
    } else {
        const activeParticipants = participants.filter(p => p.name.trim() !== '');
        
        // --- VALIDATION LOGIC ---
        if (effectiveTotal > 0 && activeParticipants.length === 0) {
            setValidationError("Please add at least one participant to the bill.");
            return;
        }

        const totalOwedByParticipants = activeParticipants.reduce((sum, p) => sum + p.amountOwed, 0);
        const discrepancy = effectiveTotal - totalOwedByParticipants;

        if (Math.abs(discrepancy) > 0.01) {
            let errorMessage = `The participant totals ($${totalOwedByParticipants.toFixed(2)}) do not add up to the bill total ($${effectiveTotal.toFixed(2)}).`;
            if (splitMode === 'item') {
                errorMessage += " Please ensure every item is assigned to at least one participant.";
            } else if (splitMode === 'amount') {
                errorMessage += ` The amounts entered are off by $${(splitRemainder).toFixed(2)}.`;
            } else if (splitMode === 'percentage') {
                errorMessage += ` The percentages add up to ${splitTotal.toFixed(0)}%, not 100%.`;
            }
            setValidationError(errorMessage);
            return;
        }
        
        const finalParticipants = activeParticipants.map(({ splitValue, ...p }) => p);
        const finalAdditionalInfo = additionalInfo
            .filter(info => info.key.trim() !== '' && info.value.trim() !== '')
            .reduce((acc, { key, value }) => {
                acc[key.trim()] = value.trim();
                return acc;
            }, {} as Record<string, string>);
        
        const billData: Omit<Bill, 'id' | 'status'> = {
            description, totalAmount: effectiveTotal, date, participants: finalParticipants, items, receiptImage,
            additionalInfo: Object.keys(finalAdditionalInfo).length > 0 ? finalAdditionalInfo : undefined
        };
        onSave(billData, mode === 'create-from-recurring' ? initialData?.id : undefined);
    }
  };
  
  const handleCancel = () => {
    if (isDirty) {
      requestConfirmation('Discard Changes?', 'Are you sure? All entered data will be lost.', onCancel, { confirmText: 'Discard', confirmVariant: 'danger' });
    } else { onCancel(); }
  };
  
  const saveButtonText = useMemo(() => {
    if (mode === 'edit-recurring') return 'Save Template';
    if (isRecurring) return 'Create Template';
    return 'Save Bill';
  }, [mode, isRecurring]);

  const splitOptions: { id: SplitMode, label: string }[] = [
    { id: 'equally', label: 'Equally' }, { id: 'amount', label: 'By Amount' }, { id: 'percentage', label: 'By %' }, { id: 'item', label: 'By Item' }
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={handleCancel} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        Back
      </button>

      {isItemEditorOpen && <ItemEditor initialItems={items} participants={participants} onSave={handleSaveItems} onCancel={() => setIsItemEditorOpen(false)} isRecurring={isRecurring} />}
      {isInfoEditorOpen && <AdditionalInfoEditor initialInfo={additionalInfo} onSave={handleSaveInfo} onCancel={() => setIsInfoEditorOpen(false)} />}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200 mb-6">{mode === 'edit-recurring' ? 'Edit Recurring Bill' : (mode === 'create-from-recurring' ? 'Create Bill from Template' : 'Create New Bill')}</h2>

        {!isRecurring && <ReceiptScanner onItemsScanned={handleItemsScanned} onImageSelected={setReceiptImage} onImageCleared={() => setReceiptImage(null)} />}

        <div className="space-y-6">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
            <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g., Monthly Rent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                {isRecurring ? 'Default Total (Optional)' : 'Total Amount'}
              </label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                <input 
                  id="totalAmount" 
                  type="number" 
                  step="0.01" 
                  value={totalAmount} 
                  onChange={(e) => setTotalAmount(e.target.value)} 
                  onBlur={handleTotalAmountBlur} 
                  disabled={!isRecurring && hasPricedItems} 
                  required={!isRecurring}
                  className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-700/50" 
                  placeholder="0.00" 
                />
              </div>
            </div>
            {!isRecurring && (
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Date</label>
                <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button type="button" onClick={() => setIsItemEditorOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM5 11a1 1 0 100 2h4a1 1 0 100-2H5z" /></svg>
                <span>{items.length > 0 ? `Edit ${items.length} Items` : 'Itemize Bill'}</span>
            </button>
            <button type="button" onClick={() => setIsInfoEditorOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                <span>{additionalInfo.length > 0 ? `Edit ${additionalInfo.length} Details` : 'Add Details'}</span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Participants</h3>
              <div className="flex items-center gap-2">
                {!isMyselfInList && <button type="button" onClick={handleAddMyself} className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline">Add Myself</button>}
                {isContactPickerSupported && <button type="button" onClick={() => handleSelectContact(`p-${Date.now()}`)} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-600 dark:text-teal-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4a1 1 0 00-1 1v1a1 1 0 002 0V5a1 1 0 00-1-1zm12 0a1 1 0 00-1 1v1a1 1 0 002 0V5a1 1 0 00-1-1zM5.414 9.414a1 1 0 00-1.414 1.414V12a1 1 0 002 0v-.586a1 1 0 00-1.414-1.414zM16 11.414a1 1 0 00-1.414-1.414 1 1 0 00-1.414 1.414V12a1 1 0 002 0v-.586zM8 9a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /><path d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1H3zm12 1a1 1 0 011 1v1a1 1 0 11-2 0V5a1 1 0 011-1zM5 4a1 1 0 011-1h1a1 1 0 110 2H6a1 1 0 01-1-1zm11 9.414a1 1 0 01-1.414 1.414V16a1 1 0 11-2 0v-.586a1 1 0 01-1.414-1.414 1 1 0 011.414-1.414V12a1 1 0 112 0v.586a1 1 0 011.414 1.414zM5 11.414a1 1 0 01-1.414 1.414V16a1 1 0 11-2 0v-.586a1 1 0 01-1.414-1.414 1 1 0 011.414-1.414V12a1 1 0 112 0v.586a1 1 0 011.414 1.414zM8 13a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /></svg></button>}
              </div>
            </div>
            
            <div className="space-y-3">
                {participants.map((p, index) => (
                    <div key={p.id} className="flex items-center gap-3">
                        <input type="text" value={p.name} onChange={(e) => handleParticipantChange(p.id, 'name', e.target.value)} placeholder={`Participant ${index + 1}`} className="flex-grow px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                        {participants.length > 1 && <button type="button" onClick={() => handleRemoveParticipant(p.id)} className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500" aria-label={`Remove ${p.name}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg></button>}
                    </div>
                ))}
            </div>
            <button type="button" onClick={handleAddParticipant} className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Add Participant
            </button>
          </div>
          
          <div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">Split Method</h3>
               <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                {splitOptions.map(opt => (
                    <button type="button" key={opt.id} onClick={() => handleSplitModeChange(opt.id)}
                    className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${splitMode === opt.id ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {opt.label}
                    </button>
                ))}
              </div>
          </div>
          
          {(splitMode === 'amount' || splitMode === 'percentage') && (
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                {participants.filter(p => p.name.trim() !== '').map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                        <label htmlFor={`split-${p.id}`} className="text-slate-700 dark:text-slate-200">{p.name}</label>
                        <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">{splitMode === 'amount' ? '$' : '%'}</span>
                           <input id={`split-${p.id}`} type="number" step="0.01" value={p.splitValue || ''} onChange={(e) => handleParticipantChange(p.id, 'splitValue', e.target.value)} className="w-full pl-7 pr-2 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                        </div>
                    </div>
                ))}
                 {!isSplitValid && !isRecurring && (
                  <p className="text-xs text-center font-semibold text-red-600 dark:text-red-400 pt-2">
                    {splitMode === 'amount' ? `Total does not match bill. Off by $${splitRemainder.toFixed(2)}.` : `Total percentage is ${splitTotal.toFixed(2)}%, not 100%.`}
                  </p>
                )}
            </div>
          )}
          
          {mode !== 'create-from-recurring' && (
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-200">
                          {mode === 'edit-recurring' ? 'Make this a recurring bill template?' : 'Save as a recurring bill?'}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Automatically generate this bill on a schedule.</p>
                  </div>
                  <button type="button" onClick={() => setIsRecurring(prev => !prev)} className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isRecurring ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
              </div>
          )}

          {isRecurring && <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />}

        </div>
        
        {validationError && (
          <div className="mt-6 p-3 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/40 dark:text-red-300" role="alert">
             <span className="font-medium">Validation Error:</span> {validationError}
          </div>
        )}

        <div className="mt-8 flex justify-end gap-4">
          <button type="button" onClick={handleCancel} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
          <button type="submit" className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">{saveButtonText}</button>
        </div>
      </form>
    </div>
  );
};

export default CreateBill;