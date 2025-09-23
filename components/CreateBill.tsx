import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Bill, Participant, ReceiptItem, Settings, RecurringBill, RecurrenceRule, SplitMode } from '../types.ts';
import type { RequestConfirmationFn } from '../App.tsx';
import ReceiptScanner from './ReceiptScanner.tsx';
import ItemEditor from './ItemEditor.tsx';
import RecurrenceSelector from './RecurrenceSelector.tsx';

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
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [participants, setParticipants] = useState<Participant[]>(
      initialData?.participants || [{ id: `p-${Date.now()}`, name: settings.myDisplayName, amountOwed: 0, paid: true, splitValue: 0 }]
  );
  const [items, setItems] = useState<ReceiptItem[]>(initialData?.items || []);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitMode>(initialData?.splitMode || 'equally');

  const [isRecurring, setIsRecurring] = useState(mode === 'edit-recurring' || mode === 'create-from-recurring');
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(initialData?.recurrenceRule || {
    frequency: 'monthly', interval: 1, dayOfMonth: new Date().getDate(),
  });

  const [isContactPickerSupported, setIsContactPickerSupported] = useState(false);
  useEffect(() => { 'contacts' in navigator && 'ContactsManager' in window && setIsContactPickerSupported(true); }, []);

  const isDirty = useMemo(() => description !== '' || totalAmount !== '' || participants.length > 1 || items.length > 0, [description, totalAmount, participants, items]);
  
  useEffect(() => {
    if (mode === 'create-from-recurring' && initialData) {
      setDescription(initialData.description);
      setParticipants(initialData.participants.map(p => ({ ...p, id: `p-${Date.now()}-${Math.random()}` })));
      setItems(initialData.items.map(i => ({...i, id: `i-${Date.now()}-${Math.random()}`, price: 0})));
      setSplitMode(initialData.splitMode || (initialData.items.length > 0 ? 'item' : 'equally'));
      setIsRecurring(false); // We are creating a regular bill, not a template.
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

  const handleItemsScanned = (data: { description: string, date?: string, items: { name: string, price: number }[] }) => {
    if (data.description) setDescription(prev => prev || data.description);
    if (data.date) setDate(data.date);
    const newItems: ReceiptItem[] = data.items.map((item, index) => ({ id: `item-scan-${Date.now()}-${index}`, name: item.name, price: item.price, assignedTo: [] }));
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

        const recurringBillData = {
            description,
            participants: finalParticipants,
            items: finalItems,
            recurrenceRule,
            splitMode,
        };
        if (mode === 'edit-recurring' && initialData) {
            onUpdateRecurring({ ...recurringBillData, id: initialData.id, status: initialData.status, nextDueDate: initialData.nextDueDate });
        } else {
            onSaveRecurring(recurringBillData);
        }
    } else {
        const finalParticipants = participants.filter(p => p.name.trim() !== '').map(({ splitValue, ...p }) => p);
        const billData: Omit<Bill, 'id' | 'status'> = {
            description, totalAmount: effectiveTotal, date, participants: finalParticipants, items, receiptImage,
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

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200 mb-6">{mode === 'edit-recurring' ? 'Edit Recurring Bill' : (mode === 'create-from-recurring' ? 'Create Bill from Template' : 'Create New Bill')}</h2>

        {!isRecurring && <ReceiptScanner onItemsScanned={handleItemsScanned} onImageSelected={setReceiptImage} onImageCleared={() => setReceiptImage(null)} />}

        <div className="space-y-6">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
            <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g., Monthly Rent" />
          </div>

          {!isRecurring && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Total Amount</label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                  <input id="totalAmount" type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} onBlur={handleTotalAmountBlur} disabled={hasPricedItems} required={!isRecurring} className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-700/50" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Date</label>
                <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
              </div>
            </div>
          )}
          
          <button type="button" onClick={() => setIsItemEditorOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM5 11a1 1 0 100 2h8a1 1 0 100-2H5z" /></svg>
              <span>{items.length > 0 ? `Edit ${items.length} Item${items.length > 1 ? 's' : ''}` : (isRecurring ? 'Add Default Items' : 'Itemize Bill')}</span>
          </button>

          <div className="my-8 border-t border-slate-200 dark:border-slate-700" />
          
          {mode !== 'create-from-recurring' && mode !== 'edit-recurring' &&
             <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div><h3 className="font-semibold text-slate-700 dark:text-slate-200">Create a Recurring Bill?</h3><p className="text-sm text-slate-500 dark:text-slate-400">Save this as a template for future use.</p></div>
                <button type="button" onClick={() => setIsRecurring(prev => !prev)} className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isRecurring ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}><span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`} /></button>
            </div>
          }

          {isRecurring && <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />}
          
          <div>
            <h3 className="text-xl font-semibold mb-3 text-slate-700 dark:text-slate-200">Participants</h3>
            
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{isRecurring ? 'Default Split Method' : 'Split Method'}</label>
                <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                    {splitOptions.map(opt => (
                        <button type="button" key={opt.id} onClick={() => handleSplitModeChange(opt.id)} disabled={opt.id === 'item' && items.length === 0}
                            className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors capitalize disabled:opacity-50 disabled:cursor-not-allowed ${splitMode === opt.id ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
            
            <ul className="space-y-3">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <div className="flex-grow relative">
                    <label htmlFor={`p-name-${p.id}`} className="sr-only">Participant Name</label>
                    <input id={`p-name-${p.id}`} type="text" value={p.name} onChange={(e) => handleParticipantChange(p.id, 'name', e.target.value)} required className={`w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 ${isContactPickerSupported ? 'pr-10' : ''}`} placeholder="Participant Name" />
                    {isContactPickerSupported && <button type="button" onClick={() => handleSelectContact(p.id)} className="absolute right-0 top-0 h-full px-3 flex items-center text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400" aria-label="Select from contacts" title="Select from contacts"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2-2H6a2 2 0 01-2-2V4zm2 2a1 1 0 00-1 1v2a1 1 0 001 1h8a1 1 0 001-1V7a1 1 0 00-1-1H6zm1 6a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg></button>}
                  </div>
                   {(splitMode === 'amount' || splitMode === 'percentage') && (
                       <div className="w-28 relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">{splitMode === 'amount' ? '$' : '%'}</span>
                         <input type="number" step="0.01" value={p.splitValue || ''} onChange={e => handleParticipantChange(p.id, 'splitValue', e.target.value)} className="w-full pl-7 pr-2 py-2 border border-slate-300 rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" placeholder="0.00" />
                       </div>
                   )}
                   {!isRecurring && splitMode !== 'item' && (
                        <div className="w-28 text-right text-lg font-semibold text-slate-800 dark:text-slate-100">
                           ${p.amountOwed.toFixed(2)}
                        </div>
                   )}
                  <button type="button" onClick={() => handleRemoveParticipant(p.id)} disabled={participants.length <= 1} className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 disabled:text-slate-400 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                </li>
              ))}
            </ul>

            {!isRecurring && (splitMode === 'amount' || splitMode === 'percentage') && (
                <div className={`mt-3 p-3 rounded-md text-sm text-center font-medium ${isSplitValid ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-red-50 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                    {splitMode === 'amount' && `Total Assigned: $${splitTotal.toFixed(2)}. Remainder: $${splitRemainder.toFixed(2)}`}
                    {splitMode === 'percentage' && `Total Assigned: ${splitTotal.toFixed(2)}%`}
                </div>
            )}
            
            <div className="mt-4 flex flex-col sm:flex-row gap-4">
              <button type="button" onClick={handleAddMyself} disabled={isMyselfInList} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                <span>Add Myself</span>
              </button>
              <button type="button" onClick={handleAddParticipant} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                <span>Add Participant</span>
              </button>
            </div>
          </div>
          
          {splitMode === 'item' && items.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-semibold mb-3 text-slate-700 dark:text-slate-200">Assign Items</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {isRecurring
                      ? 'Set default assignments for this template. The cost will be split evenly when a bill is created.'
                      : 'Assign each item to participants. The cost will be split evenly among those selected for that item.'
                    }
                </p>
                <ul className="space-y-4">
                    {items.map(item => (
                        <li key={item.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{item.name || 'Unnamed Item'}</span>
                                {!isRecurring && <span className="font-bold text-slate-900 dark:text-slate-50">${item.price.toFixed(2)}</span>}
                            </div>
                            <div className="mt-3">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Assigned to:</p>
                                <div className="flex flex-wrap gap-2">
                                    {participants.filter(p => p.name.trim() !== '').map(p => (
                                        <button type="button" key={p.id} onClick={() => handleToggleAssignment(item.id, p.id)}
                                            className={`flex items-center justify-center h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-all ring-2 ring-offset-2 dark:ring-offset-slate-800 ${item.assignedTo.includes(p.id) ? 'bg-teal-500 text-white ring-teal-500' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 ring-transparent'}`}
                                            title={p.name}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
            <button type="button" onClick={handleCancel} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">{saveButtonText}</button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateBill;