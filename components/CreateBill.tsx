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
  settings: Settings | null;
  billTemplate: RecurringBill | { forEditing: RecurringBill } | null;
}

const getTemplateData = (templateProp: RecurringBill | { forEditing: RecurringBill } | null) => {
    if (!templateProp) return { template: null, isEditing: false, fromTemplateId: null };
    if ('forEditing' in templateProp) {
        return { template: templateProp.forEditing, isEditing: true, fromTemplateId: null };
    }
    return { template: templateProp, isEditing: false, fromTemplateId: templateProp.id };
}

export const CreateBill: React.FC<CreateBillProps> = ({
  onSave, onSaveRecurring, onUpdateRecurring, onCancel, requestConfirmation, settings, billTemplate: templateProp
}) => {
  const { template, isEditing, fromTemplateId } = getTemplateData(templateProp);

  // --- State Initialization ---
  const [description, setDescription] = useState(template?.description || '');
  const [totalAmount, setTotalAmount] = useState<number | undefined>(template?.totalAmount);
  const [date, setDate] = useState(template?.nextDueDate || new Date().toISOString().split('T')[0]);
  const [participants, setParticipants] = useState<Participant[]>(() => {
    const initialParticipants = template?.participants ? JSON.parse(JSON.stringify(template.participants)) : [];
    if (initialParticipants.length === 0 && settings?.myDisplayName) {
        return [{ id: `p-${Date.now()}`, name: settings.myDisplayName, amountOwed: 0, paid: true }];
    }
    return initialParticipants;
  });
  const [items, setItems] = useState<ReceiptItem[]>(() => template?.items ? JSON.parse(JSON.stringify(template.items)) : []);
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);
  const [additionalInfo, setAdditionalInfo] = useState(() => {
    const info = template?.additionalInfo;
    return info ? Object.entries(info).map(([key, value], i) => ({ id: `info-template-${i}`, key, value: String(value) })) : [];
  });

  // --- Bill Logic State ---
  const [splitMode, setSplitMode] = useState<SplitMode>(template?.splitMode || 'equally');
  const [isRecurring, setIsRecurring] = useState(isEditing || !!template?.recurrenceRule);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(template?.recurrenceRule || {
    frequency: 'monthly', interval: 1, dayOfMonth: new Date().getDate()
  });

  // --- UI State ---
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [isInfoEditorOpen, setIsInfoEditorOpen] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // --- Derived State ---
  const myNameLower = settings?.myDisplayName.toLowerCase().trim();

  // --- Effects ---
  useEffect(() => {
    const activeParticipants = participants.filter(p => p.name.trim() !== '');
    if (activeParticipants.length === 0 || !totalAmount || splitMode === 'item') return;

    let newParticipants = JSON.parse(JSON.stringify(participants));

    switch (splitMode) {
        case 'equally':
            const amountPerPerson = totalAmount / activeParticipants.length;
            newParticipants.forEach((p: Participant) => {
                p.amountOwed = p.name.trim() ? amountPerPerson : 0;
            });
            break;
        case 'amount':
            const totalSplit = newParticipants.reduce((sum: number, p: Participant) => sum + (p.splitValue || 0), 0);
            if (Math.abs(totalSplit - totalAmount) > 0.01) {
                setErrors(prev => ({ ...prev, split: `Amounts must add up to $${totalAmount.toFixed(2)}. Current total: $${totalSplit.toFixed(2)}` }));
            } else {
                setErrors(prev => ({ ...prev, split: '' }));
            }
            newParticipants.forEach((p: Participant) => p.amountOwed = p.splitValue || 0);
            break;
        case 'percentage':
            const totalPercent = newParticipants.reduce((sum: number, p: Participant) => sum + (p.splitValue || 0), 0);
             if (Math.abs(totalPercent - 100) > 0.1) {
                setErrors(prev => ({ ...prev, split: `Percentages must add up to 100%. Current total: ${totalPercent.toFixed(2)}%`}));
            } else {
                setErrors(prev => ({ ...prev, split: '' }));
            }
            newParticipants.forEach((p: Participant) => p.amountOwed = (totalAmount * (p.splitValue || 0)) / 100);
            break;
    }
    
    setParticipants(newParticipants);

  }, [totalAmount, splitMode, participants.length, participants.map(p => p.splitValue).join(',')]);
  
  useEffect(() => {
    if (splitMode !== 'item' || items.length === 0) return;
    
    const newParticipants = JSON.parse(JSON.stringify(participants));
    let newTotal = 0;

    newParticipants.forEach((p: Participant) => p.amountOwed = 0);
    
    items.forEach(item => {
        newTotal += item.price;
        if (item.assignedTo.length > 0) {
            const pricePerPerson = item.price / item.assignedTo.length;
            item.assignedTo.forEach(participantId => {
                const participant = newParticipants.find((p: Participant) => p.id === participantId);
                if (participant) {
                    participant.amountOwed += pricePerPerson;
                }
            });
        }
    });
    setParticipants(newParticipants);
    setTotalAmount(newTotal);

  }, [items, splitMode]);
  
  // --- Handlers ---
  const handleAddParticipant = () => {
    setParticipants([...participants, { id: `p-${Date.now()}`, name: '', amountOwed: 0, paid: false, splitValue: 0 }]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (participants.length > 1) {
        setParticipants(participants.filter(p => p.id !== id));
    }
  };
  
  const handleParticipantChange = (id: string, field: 'name' | 'splitValue', value: string) => {
    const newParticipants = participants.map(p => {
        if (p.id === id) {
            if (field === 'name') {
                return { ...p, name: value };
            }
            const numericValue = parseFloat(value) || 0;
            return { ...p, splitValue: numericValue };
        }
        return p;
    });
    setParticipants(newParticipants);
  };

  const handleItemsScanned = (data: any) => {
    setDescription(data.description || '');
    if (data.date) setDate(data.date);
    if (data.total) setTotalAmount(data.total);

    const newItems = data.items.map((item: any, index: number) => ({
      id: `item-scan-${Date.now()}-${index}`,
      name: item.name,
      price: item.price,
      assignedTo: [],
    }));
    setItems(newItems);

    const newInfo = data.additionalInfo?.map((info: any, index: number) => ({
      id: `info-scan-${Date.now()}-${index}`,
      key: info.key,
      value: info.value,
    })) || [];
    setAdditionalInfo(newInfo);
    
    setSplitMode('item');
  };

  const handleSaveItems = (updatedItems: ReceiptItem[]) => {
    setItems(updatedItems);
    setIsItemEditorOpen(false);
  };
  
  const handleSaveInfo = (updatedInfo: { id: string; key: string; value: string }[]) => {
    setAdditionalInfo(updatedInfo);
    setIsInfoEditorOpen(false);
  };
  
  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!description.trim()) newErrors.description = "Description is required.";
    if (!isRecurring && (!totalAmount || totalAmount <= 0)) newErrors.totalAmount = "Total amount must be greater than zero.";
    if (isRecurring && totalAmount && totalAmount < 0) newErrors.totalAmount = "Total amount cannot be negative.";
    if (participants.filter(p => p.name.trim()).length < 1) newErrors.participants = "At least one participant is required.";
    if (errors.split) newErrors.split = errors.split;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSaveClick = () => {
    if (!validate()) return;
    
    const finalParticipants = participants
      .filter(p => p.name.trim() !== '')
      .map(p => ({
          ...p,
          paid: p.name.toLowerCase().trim() === myNameLower
      }));
    
    const additionalInfoObject = additionalInfo.reduce((acc, info) => {
      if (info.key.trim()) acc[info.key.trim()] = info.value;
      return acc;
    }, {} as Record<string, string>);
      
    if (isRecurring) {
        const recurringBillData = {
            description,
            totalAmount: totalAmount || undefined,
            // FIX: Ensure template participants conform to the Participant type by setting amountOwed and paid to default values.
            participants: finalParticipants.map(({ amountOwed, paid, ...rest }) => ({ ...rest, amountOwed: 0, paid: false })),
            items: items.map(({ price, ...rest }) => ({...rest, price: isEditing ? price : 0})),
            splitMode,
            recurrenceRule,
            additionalInfo: additionalInfoObject,
        };
        if (isEditing && template) {
            onUpdateRecurring({ ...template, ...recurringBillData });
        } else {
            onSaveRecurring(recurringBillData);
        }
    } else {
        const billData: Omit<Bill, 'id' | 'status'> = {
            description,
            totalAmount: totalAmount || 0,
            date,
            participants: finalParticipants,
            items,
            receiptImage,
            additionalInfo: additionalInfoObject,
        };
        onSave(billData, fromTemplateId || undefined);
    }
  };

  const handleBack = () => {
     requestConfirmation('Discard Changes?', 'Are you sure you want to discard this new bill?', onCancel);
  };

  // --- Render Logic ---
  const renderParticipantInputs = () => (
    <div className="space-y-3">
        {participants.map((p, index) => (
            <div key={p.id} className="flex items-center gap-2">
                <input type="text" value={p.name} onChange={e => handleParticipantChange(p.id, 'name', e.target.value)} placeholder={`Participant ${index + 1}`} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                {(splitMode === 'amount' || splitMode === 'percentage') && (
                    <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">{splitMode === 'amount' ? '$' : '%'}</span>
                        <input type="number" step="0.01" value={p.splitValue || ''} onChange={e => handleParticipantChange(p.id, 'splitValue', e.target.value)} className="w-full pl-7 pr-2 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                    </div>
                )}
                <button onClick={() => handleRemoveParticipant(p.id)} disabled={participants.length <= 1} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg></button>
            </div>
        ))}
        <button onClick={handleAddParticipant} className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
            <span>Add Participant</span>
        </button>
        {errors.participants && <p className="text-sm text-red-500">{errors.participants}</p>}
    </div>
  );

  return (
    <>
    {isItemEditorOpen && <ItemEditor initialItems={items} participants={participants} onSave={handleSaveItems} onCancel={() => setIsItemEditorOpen(false)} isRecurring={isRecurring}/>}
    {isInfoEditorOpen && <AdditionalInfoEditor initialInfo={additionalInfo} onSave={handleSaveInfo} onCancel={() => setIsInfoEditorOpen(false)} />}
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200 mb-6">{isEditing ? 'Edit Template' : (fromTemplateId ? 'Create Bill from Template' : 'Create New Bill')}</h2>

        <div className="flex items-center justify-end mb-6">
            <label htmlFor="isRecurring" className="mr-3 font-medium text-slate-700 dark:text-slate-200">
                {isEditing ? 'This is a recurring template' : 'Save as recurring template?'}
            </label>
            <button
                id="isRecurring"
                type="button"
                onClick={() => setIsRecurring(!isRecurring)}
                disabled={isEditing}
                className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isEditing ? 'opacity-50 cursor-not-allowed' : ''} ${isRecurring ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>

        {!isRecurring && (
            <ReceiptScanner 
                onItemsScanned={handleItemsScanned}
                onImageSelected={setReceiptImage}
                onImageCleared={() => setReceiptImage(undefined)}
            />
        )}
        
        <div className="space-y-6">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
            <input id="description" type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
            {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className={`flex-1 ${isRecurring ? 'w-full' : 'sm:w-1/2'}`}>
                <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Total Amount {isRecurring && '(Optional)'}</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                    <input id="totalAmount" type="number" step="0.01" value={totalAmount === undefined ? '' : totalAmount} onChange={e => setTotalAmount(e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={splitMode === 'item'} className="w-full pl-7 pr-2 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-600" />
                </div>
                 {errors.totalAmount && <p className="text-sm text-red-500 mt-1">{errors.totalAmount}</p>}
            </div>
            {!isRecurring && (
                <div className="flex-1 sm:w-1/2">
                    <label htmlFor="date" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Date</label>
                    <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                </div>
            )}
          </div>
          
          {isRecurring && <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />}

          <div>
            <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-200">Split Method</h3>
            <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                <button type="button" onClick={() => setSplitMode('equally')} className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${splitMode === 'equally' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>Equally</button>
                <button type="button" onClick={() => setSplitMode('amount')} className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${splitMode === 'amount' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By Amount</button>
                <button type="button" onClick={() => setSplitMode('percentage')} className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${splitMode === 'percentage' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By %</button>
                <button type="button" onClick={() => setSplitMode('item')} className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${splitMode === 'item' ? 'bg-white dark:bg-slate-800 shadow text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>By Item</button>
            </div>
            {errors.split && <p className="text-sm text-red-500 mt-2">{errors.split}</p>}
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-200">Participants</h3>
            {renderParticipantInputs()}
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">{isRecurring ? 'Default Items' : 'Itemization'}</h3>
                <button type="button" onClick={() => setIsItemEditorOpen(true)} className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline">Edit Items ({items.length})</button>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm text-slate-600 dark:text-slate-300">
                {items.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                        {items.slice(0, 3).map(item => <li key={item.id}>{item.name}{!isRecurring && ` ($${item.price.toFixed(2)})`}</li>)}
                        {items.length > 3 && <li>...and {items.length - 3} more.</li>}
                    </ul>
                ) : 'No items added yet.'}
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Additional Details</h3>
                <button type="button" onClick={() => setIsInfoEditorOpen(true)} className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline">Edit Details ({additionalInfo.length})</button>
            </div>
          </div>

        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button onClick={handleBack} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
          <button onClick={handleSaveClick} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">{isEditing ? 'Update Template' : 'Save'}</button>
        </div>

      </div>
    </div>
    </>
  );
};
