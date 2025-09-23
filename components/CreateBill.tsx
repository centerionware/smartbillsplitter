import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Bill, Participant, ReceiptItem, Settings, RecurringBill, RecurrenceRule } from '../types.ts';
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
  billTemplate?: RecurringBill | { forEditing: RecurringBill } | null;
}

interface ScannedData {
  description: string;
  date?: string;
  items: { name: string; price: number }[];
  total?: number;
}

type SplitMode = 'even' | 'item' | 'amount' | 'percentage';

const CreateBill: React.FC<CreateBillProps> = ({ onSave, onSaveRecurring, onUpdateRecurring, onCancel, requestConfirmation, settings, billTemplate }) => {
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [participantError, setParticipantError] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [receiptImage, setReceiptImage] = useState<string | undefined>();
  const [splitMode, setSplitMode] = useState<SplitMode>('even');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [contactError, setContactError] = useState('');
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  
  // Recurring Bill State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>({ frequency: 'monthly', interval: 1, dayOfMonth: new Date().getDate() });
  
  const templateForInstance = billTemplate && 'id' in billTemplate ? billTemplate : null;
  const templateForEditing = billTemplate && 'forEditing' in billTemplate ? billTemplate.forEditing : null;
  const isEditingTemplate = !!templateForEditing;
  const isFromTemplate = !!templateForInstance;

  useEffect(() => {
    const template = templateForInstance || templateForEditing;
    if (template) {
        setDescription(template.description);
        setParticipants(template.participants.map(p => ({...p, amountOwed: 0, paid: false})));
        setItems(template.items?.map(i => ({...i, price: 0, assignedTo: []})) || []);
    }
    if (templateForEditing) {
        setIsRecurring(true);
        setRecurrenceRule(templateForEditing.recurrenceRule);
    }
  }, [billTemplate]);

  const isDirty = useMemo(() => {
    return description !== '' || totalAmount !== '' || participants.length > 0 || items.length > 0 || receiptImage !== undefined;
  }, [description, totalAmount, participants, items, receiptImage]);

  const handleCancel = () => {
    if (isDirty) {
      requestConfirmation(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        onCancel,
        { confirmText: 'Discard', confirmVariant: 'danger' }
      );
    } else {
      onCancel();
    }
  };
  
  const addParticipant = (name: string) => {
    const trimmedName = name.trim();
     if (trimmedName && !participants.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
        const newParticipant: Participant = {
            id: `p-${new Date().getTime()}-${trimmedName}`,
            name: trimmedName,
            amountOwed: 0,
            paid: false,
        };
        setParticipants(prev => [...prev, newParticipant]);
        return true;
    } else if (trimmedName) {
        setParticipantError(`'${trimmedName}' has already been added.`);
        return false;
    }
    return false;
  }

  const handleAddParticipant = () => {
    if (addParticipant(newParticipantName)) {
        setNewParticipantName('');
        setParticipantError('');
    }
  };

  const handleAddMyself = () => { addParticipant(settings.myDisplayName || 'Myself'); }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); handleAddParticipant(); } };

  const handleSelectContacts = async () => {
    const isContactApiSupported = 'contacts' in navigator && 'select' in (navigator as any).contacts;
    if (!isContactApiSupported) return;
    setContactError('');
    try {
      const contacts = await (navigator as any).contacts.select(['name'], { multiple: true });
      if (contacts.length > 0) {
        contacts.forEach((c: any) => addParticipant(c.name[0]));
      }
    } catch (ex: any) {
       if (ex.name === 'AbortError') return;
       setContactError("Could not retrieve contacts. This feature requires a supported browser (like Chrome on Android) and a secure (HTTPS) connection.");
    }
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
    setCustomSplits(prev => { const next = {...prev}; delete next[id]; return next; });
    setItems(prevItems => prevItems.map(item => ({...item, assignedTo: item.assignedTo.filter(pId => pId !== id)})));
  };
  
  const handleItemsScanned = useCallback((data: ScannedData) => {
    const newDescription = data.date ? `${data.description} (${data.date})` : data.description;
    setDescription(newDescription);
    const newReceiptItems = data.items.map((item, index) => ({...item, id: `item-${new Date().getTime()}-${index}`, assignedTo: []}));
    setItems(newReceiptItems);
    const newTotal = data.total ?? newReceiptItems.reduce((sum, item) => sum + item.price, 0);
    setTotalAmount(Math.round(newTotal * 100) / 100);
    setSplitMode('item');
  }, []);

  const handleSaveItems = (updatedItems: ReceiptItem[]) => {
    setItems(updatedItems);
    if (!isRecurring) {
        const newTotal = updatedItems.reduce((sum: number, item) => sum + item.price, 0);
        setTotalAmount(Math.round(newTotal * 100) / 100);
    }
    setIsItemEditorOpen(false);
  };

  const toggleItemAssignment = (itemId: string, participantId: string) => { setItems(prevItems => prevItems.map(item => { if (item.id === itemId) { const assigned = item.assignedTo.includes(participantId); return {...item, assignedTo: assigned ? item.assignedTo.filter(pId => pId !== participantId) : [...item.assignedTo, participantId]}; } return item; })); };
  const handleCustomSplitChange = (participantId: string, value: string) => { if (/^\d*\.?\d*$/.test(value)) { setCustomSplits(prev => ({...prev, [participantId]: value})); } };
  
  const handleEvenPercentageSplit = () => {
    const numParticipants = participants.length; if (numParticipants === 0) return; const newSplits: Record<string, string> = {}; const basePercentage = 100 / numParticipants; let accumulatedPercentage = 0;
    participants.forEach((p, index) => { if (index === numParticipants - 1) { newSplits[p.id] = (100 - accumulatedPercentage).toFixed(2); } else { const roundedPercentage = parseFloat(basePercentage.toFixed(2)); newSplits[p.id] = roundedPercentage.toString(); accumulatedPercentage += roundedPercentage; } });
    setCustomSplits(newSplits);
  };

  const { customSplitTotal, isCustomSplitValid } = useMemo(() => {
    const total = Object.values(customSplits).reduce((sum: number, v) => sum + (parseFloat(v) || 0), 0);
    if (splitMode === 'amount') return { customSplitTotal: total, isCustomSplitValid: Math.abs(total - (Number(totalAmount) || 0)) < 0.01 };
    if (splitMode === 'percentage') return { customSplitTotal: total, isCustomSplitValid: Math.abs(total - 100) < 0.01 };
    return { customSplitTotal: 0, isCustomSplitValid: true };
  }, [customSplits, splitMode, totalAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    if (isRecurring) {
        const recurringBillPayload = {
            description,
            participants, // amountOwed and paid are irrelevant for template
            items: items.map(i => ({...i, price: 0, assignedTo: []})),
            recurrenceRule,
        };
        if (isEditingTemplate) {
            onUpdateRecurring({ ...templateForEditing, ...recurringBillPayload });
        } else {
            onSaveRecurring(recurringBillPayload);
        }
        return;
    }

    let finalParticipants = participants.map(p => ({...p, amountOwed: 0}));
    switch(splitMode) {
        case 'even': finalParticipants = finalParticipants.map(p => ({...p, amountOwed: (Number(totalAmount) || 0) / participants.length})); break;
        case 'item': items.forEach(item => { if(item.assignedTo.length > 0) { const pricePerPerson = item.price / item.assignedTo.length; item.assignedTo.forEach(pId => { const p = finalParticipants.find(p => p.id === pId); if (p) p.amountOwed += pricePerPerson; }); } }); break;
        case 'amount': finalParticipants = finalParticipants.map(p => ({...p, amountOwed: parseFloat(customSplits[p.id]) || 0})); break;
        case 'percentage': finalParticipants = finalParticipants.map(p => ({...p, amountOwed: ((Number(totalAmount) || 0) * (parseFloat(customSplits[p.id]) || 0)) / 100 })); break;
    }
    
    const processedParticipants = finalParticipants.map(p => ({...p, paid: p.amountOwed <= 0.005}));
    onSave({ description, totalAmount: Number(totalAmount) || 0, date: new Date().toISOString(), participants: processedParticipants, items: splitMode === 'item' ? items : undefined, receiptImage }, templateForInstance?.id);
  };

  const isFormValid = isRecurring ? description && participants.length > 0 : description && totalAmount && participants.length > 0 && isCustomSplitValid;

  return (
    <>
    {isItemEditorOpen && <ItemEditor initialItems={items} onSave={handleSaveItems} onCancel={() => setIsItemEditorOpen(false)} isRecurring={isRecurring}/>}
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-slate-700 dark:text-slate-200">{isEditingTemplate ? 'Edit Recurring Bill' : isRecurring ? 'New Recurring Bill' : 'Create New Bill'}</h2>
      
      {!isFromTemplate && !isEditingTemplate && (
          <div className="mb-6 flex items-center justify-center gap-4 bg-slate-100 dark:bg-slate-700 p-3 rounded-lg">
              <span className={`font-semibold ${!isRecurring ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`}>One-Time Bill</span>
              <button type="button" onClick={() => setIsRecurring(!isRecurring)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${isRecurring ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`} role="switch" aria-checked={isRecurring}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`}></span>
              </button>
              <span className={`font-semibold ${isRecurring ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`}>Recurring Bill</span>
          </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{isRecurring ? 'Template Name' : 'Description'}</label>
          <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder={isRecurring ? "e.g., Monthly Rent" : "e.g., Dinner with friends"} required />
        </div>

        {!isRecurring && <ReceiptScanner onItemsScanned={handleItemsScanned} onImageSelected={setReceiptImage} onImageCleared={() => setReceiptImage(undefined)} />}

        {!isRecurring && (
            <div className="mb-6">
                <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Total Amount</label>
                <input id="totalAmount" type="number" value={totalAmount} onChange={(e) => setTotalAmount(parseFloat(e.target.value) || '')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="0.00" required disabled={items.length > 0 && splitMode === 'item'} />
                { (splitMode === 'amount' || splitMode === 'percentage') && !totalAmount && <p className="text-sm text-amber-600 mt-1">Please enter a total amount before splitting.</p> }
            </div>
        )}
        
        {isRecurring && <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />}

        <div className="mb-6">
          <button type="button" onClick={() => setIsItemEditorOpen(true)} className="w-full text-center bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
            <span>{items.length > 0 ? `Edit Items (${items.length})` : isRecurring ? 'Add Default Items' : 'Add/Edit Itemization'}</span>
          </button>
           {isRecurring && <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">Item names will be saved as defaults. Prices can be added for each new bill.</p>}
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Participants</h3>
          <div className="flex flex-col sm:flex-row gap-2">
             <button type="button" onClick={handleAddMyself} className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold px-4 py-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                <span>Add {settings.myDisplayName || 'Myself'}</span>
              </button>
            <button type="button" onClick={handleSelectContacts} className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold px-4 py-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg>
                <span>Add from Contacts</span>
            </button>
          </div>
          <div className="flex gap-2 my-4">
              <input type="text" value={newParticipantName} onChange={(e) => { setNewParticipantName(e.target.value); if (participantError) setParticipantError(''); }} onKeyDown={handleKeyDown} className="flex-grow px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Or enter name manually" aria-label="New participant name" />
              <button type="button" onClick={handleAddParticipant} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={!newParticipantName.trim()}>Add</button>
          </div>
          {participantError && <p className="text-sm text-red-600 mt-1 mb-2">{participantError}</p>}
          {contactError && <p className="text-sm text-red-600 dark:text-red-400 mt-2 text-center">{contactError}</p>}
          <ul className="space-y-2 mt-4">{participants.map(p => (<li key={p.id} className="flex items-center justify-between bg-slate-100 dark:bg-slate-700 p-2 rounded-md"><span className="text-slate-800 dark:text-slate-100">{p.name}</span><button type="button" onClick={() => removeParticipant(p.id)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 font-bold text-xl leading-none px-2 py-1">&times;</button></li>))}</ul>
        </div>
        
        {!isRecurring && participants.length > 0 && Number(totalAmount) > 0 && (
          <>
            <div className="mb-6"><h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Split Method</h3><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSplitMode('even')} className={`px-4 py-2 rounded-lg font-semibold ${splitMode === 'even' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'}`}>Split Evenly</button><button type="button" onClick={() => setSplitMode('item')} className={`px-4 py-2 rounded-lg font-semibold ${splitMode === 'item' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'}`} disabled={!items.length}>By Item</button><button type="button" onClick={() => setSplitMode('amount')} className={`px-4 py-2 rounded-lg font-semibold ${splitMode === 'amount' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'}`} disabled={!totalAmount}>By Amount</button><button type="button" onClick={() => setSplitMode('percentage')} className={`px-4 py-2 rounded-lg font-semibold ${splitMode === 'percentage' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'}`} disabled={!totalAmount}>By %</button></div></div>
            {splitMode === 'amount' && (<div className="mb-6"><h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Enter Amounts</h3><ul className="space-y-2">{participants.map(p => (<li key={p.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-md"><label htmlFor={`split-${p.id}`} className="flex-1 text-slate-800 dark:text-slate-200">{p.name}</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span><input id={`split-${p.id}`} type="text" inputMode="decimal" value={customSplits[p.id] || ''} onChange={(e) => handleCustomSplitChange(p.id, e.target.value)} className="w-32 py-1 rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-teal-500 focus:border-teal-500 pl-6 pr-2" placeholder="0.00"/></div></li>))}{!isCustomSplitValid && <p className="text-sm text-red-600 mt-2 text-right">Total must equal ${totalAmount}. Currently: ${customSplitTotal.toFixed(2)}</p>}</ul></div>)}
            {splitMode === 'item' && items.length > 0 && (<div className="mb-6"><h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Assign Items</h3><ul className="space-y-4">{items.map(item => (<li key={item.id} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md"><div className="flex justify-between items-center mb-2"><span className="font-medium text-slate-800 dark:text-slate-200">{item.name}</span><span className="font-semibold text-slate-600 dark:text-slate-300">${item.price.toFixed(2)}</span></div><div className="flex flex-wrap gap-2">{participants.map(p => (<button type="button" key={p.id} onClick={() => toggleItemAssignment(item.id, p.id)} className={`px-3 py-1 text-sm rounded-full ${item.assignedTo.includes(p.id) ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>{p.name}</button>))}</div></li>))}</ul></div>)}
            {splitMode === 'percentage' && (<div className="mb-6"><h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Enter Percentages</h3><div className="flex justify-end mb-2"><button type="button" onClick={handleEvenPercentageSplit} className="text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">Distribute evenly</button></div><ul className="space-y-2">{participants.map(p => (<li key={p.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-md"><label htmlFor={`split-${p.id}`} className="flex-1 text-slate-800 dark:text-slate-200">{p.name}</label><div className="relative"><input id={`split-${p.id}`} type="text" inputMode="decimal" value={customSplits[p.id] || ''} onChange={(e) => handleCustomSplitChange(p.id, e.target.value)} className="w-32 py-1 rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-teal-500 focus:border-teal-500 pr-6 pl-2 text-right" placeholder="0.00"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">%</span></div></li>))}{!isCustomSplitValid && <p className="text-sm text-red-600 mt-2 text-right">Percentages must add up to 100%. Currently: {customSplitTotal.toFixed(2)}%</p>}</ul></div>)}
          </>
        )}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
            <button type="button" onClick={handleCancel} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
            <button type="submit" disabled={!isFormValid} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed">
                {isEditingTemplate ? 'Update Template' : isRecurring ? 'Save Template' : 'Create Bill'}
            </button>
        </div>
      </form>
    </div>
    </>
  );
};

export default CreateBill;