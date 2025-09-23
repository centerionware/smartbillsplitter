import React, { useState, useCallback, useMemo } from 'react';
import type { Bill, Participant, ReceiptItem, Settings } from '../types.ts';
import type { RequestConfirmationFn } from '../App.tsx';
import ReceiptScanner from './ReceiptScanner.tsx';
import ItemEditor from './ItemEditor.tsx';

interface CreateBillProps {
  onSave: (bill: Omit<Bill, 'id' | 'status'>) => void;
  onCancel: () => void;
  requestConfirmation: RequestConfirmationFn;
  settings: Settings;
}

interface ScannedData {
  description: string;
  date?: string;
  items: { name: string; price: number }[];
  total?: number;
}

type SplitMode = 'even' | 'item' | 'amount' | 'percentage';

const getInitialState = () => ({
    description: '',
    totalAmount: '' as const,
    participants: [] as Participant[],
    items: [] as ReceiptItem[],
    receiptImage: undefined as string | undefined,
});

const CreateBill: React.FC<CreateBillProps> = ({ onSave, onCancel, requestConfirmation, settings }) => {
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
  const [initialState] = useState(getInitialState);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);

  // Check for Contact Picker availability and context.
  const isContactApiSupported = 'contacts' in navigator && 'select' in (navigator as any).contacts;
  const isInIframe = window.self !== window.top;

  const isDirty = useMemo(() => {
    return (
      description !== initialState.description ||
      totalAmount !== initialState.totalAmount ||
      participants.length !== initialState.participants.length ||
      items.length !== initialState.items.length ||
      receiptImage !== initialState.receiptImage
    );
  }, [description, totalAmount, participants, items, receiptImage, initialState]);

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

  const handleAddMyself = () => {
    addParticipant(settings.myDisplayName || 'Myself');
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAddParticipant();
    }
  };

  const handleSelectContacts = async () => {
    setContactError(''); // Clear previous errors
    try {
      const contacts = await (navigator as any).contacts.select(['name'], { multiple: true });
      if (contacts.length > 0) {
        const newParticipants: Participant[] = contacts.map((contact: any) => ({
          id: `p-${new Date().getTime()}-${contact.name[0]}`,
          name: contact.name[0],
          amountOwed: 0,
          paid: false,
        }));
        
        // Filter out participants that already exist
        const participantsToAdd = newParticipants.filter(
            np => !participants.some(p => p.name === np.name)
        );

        setParticipants(prev => [...prev, ...participantsToAdd]);
      }
    } catch (ex: unknown) {
      // FIX: Handle error as 'unknown' type for improved type safety.
      // Added an 'instanceof Error' check before accessing properties.
      console.error("Error picking contacts:", ex);
       if (ex instanceof Error && ex.name === 'AbortError') {
         // This is expected when the user cancels the picker.
         // No error message is needed.
         return;
       }
       setContactError("Could not retrieve contacts. This feature requires a supported browser (like Chrome on Android) and a secure (HTTPS) connection.");
    }
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
    // Also remove from custom splits
    setCustomSplits(prev => {
        const next = {...prev};
        delete next[id];
        return next;
    });
    // Also unassign from items
    setItems(prevItems => prevItems.map(item => ({
        ...item,
        assignedTo: item.assignedTo.filter(pId => pId !== id)
    })));
  };
  
  const handleItemsScanned = useCallback((data: ScannedData) => {
    const newDescription = data.date ? `${data.description} (${data.date})` : data.description;
    setDescription(newDescription);

    const newReceiptItems = data.items.map((item, index) => ({
      ...item,
      id: `item-${new Date().getTime()}-${index}`,
      assignedTo: [],
    }));
    setItems(newReceiptItems);
    
    // Prioritize the total from the AI if available, otherwise sum the items.
    const newTotal = data.total ?? newReceiptItems.reduce((sum: number, item) => sum + item.price, 0);
    // Round to 2 decimal places to avoid floating point issues
    setTotalAmount(Math.round(newTotal * 100) / 100);

    setSplitMode('item');
  }, []);

  const handleSaveItems = (updatedItems: ReceiptItem[]) => {
    setItems(updatedItems);
    // When items are edited, the total amount should reflect the sum of the new items.
    const newTotal = updatedItems.reduce((sum: number, item) => sum + item.price, 0);
    setTotalAmount(Math.round(newTotal * 100) / 100);
    setIsItemEditorOpen(false);
  };

  const toggleItemAssignment = (itemId: string, participantId: string) => {
    setItems(prevItems => prevItems.map(item => {
        if (item.id === itemId) {
            const assigned = item.assignedTo.includes(participantId);
            return {
                ...item,
                assignedTo: assigned
                    ? item.assignedTo.filter(pId => pId !== participantId)
                    : [...item.assignedTo, participantId]
            };
        }
        return item;
    }));
  };

  const handleCustomSplitChange = (participantId: string, value: string) => {
    // Allow only numbers and a single decimal point
    if (/^\d*\.?\d*$/.test(value)) {
        setCustomSplits(prev => ({...prev, [participantId]: value}));
    }
  };
  
  const handleEvenPercentageSplit = () => {
    const numParticipants = participants.length;
    if (numParticipants === 0) return;

    const newSplits: Record<string, string> = {};
    const basePercentage = 100 / numParticipants;
    let accumulatedPercentage = 0;

    participants.forEach((p, index) => {
      if (index === numParticipants - 1) {
        // Assign the remainder to the last participant to ensure the total is exactly 100
        newSplits[p.id] = (100 - accumulatedPercentage).toFixed(2);
      } else {
        const roundedPercentage = parseFloat(basePercentage.toFixed(2));
        newSplits[p.id] = roundedPercentage.toString();
        accumulatedPercentage += roundedPercentage;
      }
    });

    setCustomSplits(newSplits);
  };

  const { customSplitTotal, isCustomSplitValid } = useMemo(() => {
    const total = Object.values(customSplits).reduce((sum: number, v) => sum + (parseFloat(v) || 0), 0);
    
    if (splitMode === 'amount') {
      // Use a small tolerance for float comparison
      return { customSplitTotal: total, isCustomSplitValid: Math.abs(total - (Number(totalAmount) || 0)) < 0.01 };
    }
    if (splitMode === 'percentage') {
      // Use a small tolerance for float comparison
      return { customSplitTotal: total, isCustomSplitValid: Math.abs(total - 100) < 0.01 };
    }
    return { customSplitTotal: 0, isCustomSplitValid: true };
  }, [customSplits, splitMode, totalAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    let finalParticipants = participants.map(p => ({...p, amountOwed: 0}));

    switch(splitMode) {
        case 'even':
            const amountPerPerson = (Number(totalAmount) || 0) / participants.length;
            finalParticipants = finalParticipants.map(p => ({...p, amountOwed: amountPerPerson}));
            break;
        case 'item':
            items.forEach(item => {
                if(item.assignedTo.length > 0) {
                    const pricePerPerson = item.price / item.assignedTo.length;
                    item.assignedTo.forEach(pId => {
                        const participant = finalParticipants.find(p => p.id === pId);
                        if (participant) {
                            participant.amountOwed += pricePerPerson;
                        }
                    });
                }
            });
            break;
        case 'amount':
            finalParticipants = finalParticipants.map(p => ({...p, amountOwed: parseFloat(customSplits[p.id]) || 0}));
            break;
        case 'percentage':
            finalParticipants = finalParticipants.map(p => {
                const percentage = parseFloat(customSplits[p.id]) || 0;
                return {...p, amountOwed: ((Number(totalAmount) || 0) * percentage) / 100 };
            });
            break;
    }
    
    const processedParticipants = finalParticipants.map(p => ({
        ...p,
        // Automatically mark as paid if the amount owed is zero.
        paid: p.amountOwed <= 0.005, // Use tolerance for float comparison
    }));

    onSave({
      description,
      totalAmount: Number(totalAmount) || 0,
      date: new Date().toISOString(),
      participants: processedParticipants,
      items: splitMode === 'item' ? items : undefined,
      receiptImage,
    });
  };

  const isFormValid = description && totalAmount && participants.length > 0 && isCustomSplitValid;

  return (
    <>
    {isItemEditorOpen && (
        <ItemEditor
          initialItems={items}
          onSave={handleSaveItems}
          onCancel={() => setIsItemEditorOpen(false)}
        />
      )}
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-slate-700 dark:text-slate-200">Create New Bill</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder="e.g., Dinner with friends"
            required
          />
        </div>

        <ReceiptScanner
          onItemsScanned={handleItemsScanned}
          onImageSelected={setReceiptImage}
          onImageCleared={() => setReceiptImage(undefined)}
        />

        <div className="mb-6">
            <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Total Amount</label>
            <input
                id="totalAmount"
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || '')}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="0.00"
                required
                disabled={items.length > 0 && splitMode === 'item'}
            />
             { (splitMode === 'amount' || splitMode === 'percentage') && !totalAmount && <p className="text-sm text-amber-600 mt-1">Please enter a total amount before splitting.</p> }
        </div>

        <div className="mb-6 -mt-2">
          <button
            type="button"
            onClick={() => setIsItemEditorOpen(true)}
            className="w-full text-center bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
            </svg>
            <span>{items.length > 0 ? `Edit Itemization (${items.length} items)` : 'Add/Edit Itemization'}</span>
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Participants</h3>
          
          {/* On mobile-first devices with Contact API, hide manual input to encourage better data */}
          {!isContactApiSupported && (
            <div className="mb-4">
              <div className="flex gap-2">
                  <input
                      type="text"
                      value={newParticipantName}
                      onChange={(e) => {
                          setNewParticipantName(e.target.value);
                          if (participantError) setParticipantError('');
                      }}
                      onKeyDown={handleKeyDown}
                      className="flex-grow px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      placeholder="Enter participant's name"
                      aria-label="New participant name"
                  />
                  <button
                      type="button"
                      onClick={handleAddParticipant}
                      className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 font-semibold px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!newParticipantName.trim()}
                  >
                      Add
                  </button>
              </div>
            </div>
          )}
          {participantError && <p className="text-sm text-red-600 mt-1 mb-2">{participantError}</p>}
          
          <div className="flex flex-col sm:flex-row gap-2">
             <button type="button" onClick={handleAddMyself} className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold px-4 py-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span>Add {settings.myDisplayName || 'Myself'}</span>
              </button>
            {isContactApiSupported && !isInIframe && (
                <button type="button" onClick={handleSelectContacts} className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-teal-500 text-white font-semibold px-4 py-3 rounded-lg hover:bg-teal-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg>
                    <span>Add from Contacts</span>
                </button>
            )}
          </div>
          {contactError && <p className="text-sm text-red-600 dark:text-red-400 mt-2 text-center">{contactError}</p>}
          {isContactApiSupported && isInIframe && (
              <p className="text-center p-3 my-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 text-sm">
                  To use "Add from Contacts," please open the app in fullscreen mode.
              </p>
          )}

          <ul className="space-y-2 mt-4">
            {participants.map(p => (
              <li key={p.id} className="flex items-center justify-between bg-slate-100 dark:bg-slate-700 p-2 rounded-md">
                <span className="text-slate-800 dark:text-slate-100">{p.name}</span>
                <button type="button" onClick={() => removeParticipant(p.id)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 font-bold text-xl leading-none px-2 py-1">&times;</button>
              </li>
            ))}
          </ul>
        </div>
        
        {participants.length > 0 && Number(totalAmount) > 0 && (
          <>
            <div className="mb-6">
                 <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Split Method</h3>
                 <div className="flex flex-wrap gap-2">
                     <button type="button" onClick={() => setSplitMode('even')} className={`px-4 py-2 rounded-lg font-semibold ${splitMode === 'even' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'}`}>Split Evenly</button>
                     <button type="button" onClick={() => setSplitMode('item')} className={`px-4 py-2 rounded-lg font-semibold ${splitMode === 'item' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'}`} disabled={!items.length}>By Item</button>
                     <button type="button" onClick={() => setSplitMode('amount')} className={`px-4 py-2 rounded-lg font-semibold ${splitMode === 'amount' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'}`} disabled={!totalAmount}>By Amount</button>
                     <button type="button" onClick={() => setSplitMode('percentage')} className={`px-4 py-2 rounded-lg font-semibold ${splitMode === 'percentage' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'}`} disabled={!totalAmount}>By %</button>
                 </div>
            </div>
        
            {splitMode === 'amount' && (
                <div className="mb-6">
                     <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Enter Amounts</h3>
                     <ul className="space-y-2">
                        {participants.map(p => (
                            <li key={p.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-md">
                                <label htmlFor={`split-${p.id}`} className="flex-1 text-slate-800 dark:text-slate-200">{p.name}</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                                    <input
                                        id={`split-${p.id}`}
                                        type="text"
                                        inputMode="decimal"
                                        value={customSplits[p.id] || ''}
                                        onChange={(e) => handleCustomSplitChange(p.id, e.target.value)}
                                        className="w-32 py-1 rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-teal-500 focus:border-teal-500 pl-6 pr-2"
                                        placeholder="0.00"
                                    />
                                </div>
                            </li>
                        ))}
                     </ul>
                     { !isCustomSplitValid && <p className="text-sm text-red-600 mt-2 text-right">Total must equal ${totalAmount}. Currently: ${customSplitTotal.toFixed(2)}</p> }
                </div>
            )}
            {splitMode === 'item' && items.length > 0 && (
                <div className="mb-6">
                     <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Assign Items</h3>
                     <ul className="space-y-4">
                        {items.map(item => (
                            <li key={item.id} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{item.name}</span>
                                    <span className="font-semibold text-slate-600 dark:text-slate-300">${item.price.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {participants.map(p => (
                                        <button
                                            type="button"
                                            key={p.id}
                                            onClick={() => toggleItemAssignment(item.id, p.id)}
                                            className={`px-3 py-1 text-sm rounded-full ${item.assignedTo.includes(p.id) ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </li>
                        ))}
                     </ul>
                </div>
            )}
            {splitMode === 'percentage' && (
                <div className="mb-6">
                     <h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-200">Enter Percentages</h3>
                     <div className="flex justify-end mb-2">
                         <button type="button" onClick={handleEvenPercentageSplit} className="text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">Distribute evenly</button>
                     </div>
                     <ul className="space-y-2">
                        {participants.map(p => (
                            <li key={p.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-md">
                                <label htmlFor={`split-${p.id}`} className="flex-1 text-slate-800 dark:text-slate-200">{p.name}</label>
                                <div className="relative">
                                    <input
                                        id={`split-${p.id}`}
                                        type="text"
                                        inputMode="decimal"
                                        value={customSplits[p.id] || ''}
                                        onChange={(e) => handleCustomSplitChange(p.id, e.target.value)}
                                        className="w-32 py-1 rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-teal-500 focus:border-teal-500 pr-6 pl-2 text-right"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">%</span>
                                </div>
                            </li>
                        ))}
                     </ul>
                     { !isCustomSplitValid && <p className="text-sm text-red-600 mt-2 text-right">Percentages must add up to 100%. Currently: {customSplitTotal.toFixed(2)}%</p> }
                </div>
            )}
          </>
        )}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
            <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors"
            >
                Cancel
            </button>
            <button
                type="submit"
                disabled={!isFormValid}
                className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
                Create Bill
            </button>
        </div>
      </form>
    </div>
    </>
  );
};

export default CreateBill;
